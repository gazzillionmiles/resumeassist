import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { requireVerifiedUser } from '@/lib/server/auth';
import { getCollections } from '@/lib/server/db/mongodb';
import { callBedrockJSON } from '@/lib/server/services/bedrock';
import { fetchJobPosting, fetchCompanySources } from '@/lib/server/services/tinyfish';
import { searchCompanyNews } from '@/lib/server/services/tavily';
import {
  JD_STRUCTURE_SYSTEM_PROMPT,
  buildJDStructurePrompt,
} from '@/lib/server/prompts/jdStructure';
import {
  COMPANY_RESEARCH_SYSTEM_PROMPT,
  buildCompanyResearchPrompt,
} from '@/lib/server/prompts/companyResearch';
import {
  MESSAGE_GENERATE_SYSTEM_PROMPT,
  buildMessageGeneratePrompt,
} from '@/lib/server/prompts/messageGenerate';
import { json, options, handleError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rateLimit';

const TONES = ['formal', 'warm_professional', 'direct_concise', 'enthusiastic'];
const schema = z
  .object({
    jobUrl: z.string().url().optional(),
    jdRawText: z.string().optional(),
    jdStructured: z.record(z.any()).optional(),
    sourceDomain: z.string().optional(),
    tone: z.enum(TONES),
    companyResearch: z.record(z.any()).optional().nullable(),
  })
  .refine((d) => d.jobUrl || (d.jdRawText && d.jdRawText.trim().length >= 50) || d.jdStructured, {
    message: 'Either jobUrl, jdRawText (at least 50 chars), or jdStructured is required',
  });

export const runtime = 'nodejs';
export async function OPTIONS() {
  return options();
}

export async function POST(request) {
  try {
    const uid = await requireVerifiedUser(request);

    const limiter = rateLimit(request, { limit: 15, windowMs: 60000, keyPrefix: `gen_${uid}` });
    if (!limiter.success) {
      return json(
        { error: 'rate_limited', message: 'Rate limit exceeded. Please wait a minute before generating again.' },
        { status: 429 }
      );
    }

    const body = schema.parse(await request.json());
    const { profiles, playbookExamples, generations } = await getCollections();
    const profile = await profiles.findOne({ user_id: uid });
    if (!profile) return json({ error: 'profile_incomplete' }, { status: 400 });

    const examples = await playbookExamples.find({ user_id: uid }).sort({ created_at: -1 }).limit(3).toArray();

    const profileContext = {
      current_title: profile.current_title ?? profile.currentTitle ?? '',
      current_ctc: profile.current_ctc ?? profile.currentCtc ?? '',
      expected_ctc: profile.expected_ctc ?? profile.expectedCtc ?? '',
      notice_period: profile.notice_period ?? profile.noticePeriod ?? '',
      location: profile.location ?? '',
      work_auth: profile.work_auth ?? profile.workAuth ?? '',
      resume: profile.resume_structured ?? null,
    };

    let rawText = (body.jdRawText || '').trim();
    let sourceDomain = body.sourceDomain || null;
    let jdStructured = body.jdStructured || null;

    // 1. Fetch JD from URL if needed
    if (!rawText && body.jobUrl) {
      console.log(`[api/generate] Fetching JD from URL: ${body.jobUrl}`);
      const fetched = await fetchJobPosting(body.jobUrl);
      rawText = fetched.rawText;
      sourceDomain = fetched.domain;
    }

    // 2. Parse & Structure JD if not already provided
    if (!jdStructured) {
      if (!rawText || rawText.length < 50) {
        return json({ error: 'insufficient_text', message: 'Job description text must be at least 50 characters.' }, { status: 400 });
      }
      console.log(`[api/generate] Structuring job description with Bedrock...`);
      jdStructured = await callBedrockJSON(
        JD_STRUCTURE_SYSTEM_PROMPT,
        buildJDStructurePrompt(rawText)
      );
      if (jdStructured.error === 'not_a_job_posting') {
        return json(
          {
            error: 'not_a_job_posting',
            message: "That doesn't look like a job posting. Paste the job description text instead.",
          },
          { status: 422 }
        );
      }
    }

    const company = (jdStructured?.company || '').trim();
    const roleTitle = jdStructured?.role_title || '';
    console.log(`[api/generate] Company: "${company}", Role: "${roleTitle}"`);

    // 3. Tavily Deep Company Research & Synthesis (performed automatically)
    let companyResearch = body.companyResearch || null;

    if (!companyResearch && company && company.toLowerCase() !== 'unknown') {
      console.log(`[api/generate] Starting automatic Tavily deep company research for "${company}"...`);
      try {
        const tavilySources = await searchCompanyNews({ company, roleTitle });
        console.log(`[api/generate] Tavily returned ${tavilySources.length} sources`);

        let fetchedArticles = [];
        const urlsToFetch = tavilySources.slice(0, 4).map((s) => s.url).filter(Boolean);

        if (urlsToFetch.length > 0) {
          try {
            console.log(`[api/generate] Fetching full text for ${urlsToFetch.length} sources via TinyFish...`);
            const fetched = await fetchCompanySources(urlsToFetch);
            fetchedArticles = urlsToFetch.map((url) => {
              const matchFetched = fetched.find((f) => f.url === url);
              const matchSource = tavilySources.find((s) => s.url === url);
              return {
                url,
                title: matchFetched?.title || matchSource?.title || 'Article',
                text: matchFetched?.text || matchSource?.content || '',
              };
            });
          } catch (tinyFishErr) {
            console.warn(`[api/generate] TinyFish fetch warning: ${tinyFishErr.message}. Using Tavily snippets.`);
            fetchedArticles = tavilySources.slice(0, 4).map((s) => ({
              url: s.url,
              title: s.title || 'Article',
              text: s.content || '',
            }));
          }
        }

        console.log(`[api/generate] Running Bedrock research synthesis and interview points extraction...`);
        const rawResearch = await callBedrockJSON(
          COMPANY_RESEARCH_SYSTEM_PROMPT,
          buildCompanyResearchPrompt({
            company,
            roleTitle,
            jdStructured,
            profile: profileContext,
            articles: fetchedArticles,
          })
        );

        const normalizedDevelopments = Array.isArray(rawResearch.recent_developments)
          ? rawResearch.recent_developments.map((dev) => {
              if (typeof dev === 'string') {
                return { headline: dev, date: '', summary: dev };
              }
              return {
                headline: dev.headline || dev.title || '',
                date: dev.date || '',
                summary: dev.summary || dev.description || '',
              };
            })
          : [];

        const normalizedInterviewPoints = Array.isArray(rawResearch.interview_points)
          ? rawResearch.interview_points.map((pt) => {
              if (typeof pt === 'string') {
                return { point: pt, context: '' };
              }
              return {
                point: pt.point || pt.title || '',
                context: pt.context || pt.description || '',
              };
            })
          : [];

        companyResearch = {
          company_name: rawResearch.company_name || company,
          role_title: roleTitle || jdStructured?.role_title || null,
          recent_developments: normalizedDevelopments,
          relevance: rawResearch.relevance || '',
          candidate_connection: rawResearch.candidate_connection || '',
          conversation_hook: rawResearch.conversation_hook || '',
          interview_points: normalizedInterviewPoints,
          key_insights: Array.isArray(rawResearch.key_insights) ? rawResearch.key_insights : [],
          sources_used:
            Array.isArray(rawResearch.sources_used) && rawResearch.sources_used.length > 0
              ? rawResearch.sources_used
              : fetchedArticles.map((a) => ({ title: a.title, url: a.url })),
        };
        console.log(`[api/generate] Research synthesis complete with ${normalizedInterviewPoints.length} interview points.`);
      } catch (researchErr) {
        console.warn(`[api/generate] Automatic company research failed: ${researchErr.message}`);
      }
    }

    // 4. Generate Outreach Messages (Email & LinkedIn)
    console.log(`[api/generate] Generating outreach messages with Bedrock (Tone: ${body.tone})...`);
    const output = await callBedrockJSON(
      MESSAGE_GENERATE_SYSTEM_PROMPT,
      buildMessageGeneratePrompt({
        jdStructured,
        profile: profileContext,
        playbookExamples: examples.map((r) => r.example_text),
        tone: body.tone,
        companyResearch: companyResearch || null,
      })
    );
    console.log(`[api/generate] Outreach message generated successfully.`);

    // 5. Store new generation in MongoDB
    const generationId = new ObjectId();
    const createdAt = new Date();
    await generations.insertOne({
      _id: generationId,
      user_id: uid,
      job_url: body.jobUrl || null,
      jd_raw_text: rawText,
      jd_structured: jdStructured,
      fetch_status: body.jobUrl ? 'ok' : 'manual_paste',
      fetch_source_domain: sourceDomain,
      tone: body.tone,
      company_research: companyResearch || null,
      email_subject: output.email_subject,
      email_output: output.email_body,
      linkedin_output: output.linkedin_message,
      company_name: company || null,
      role_title: jdStructured?.role_title || null,
      was_edited: false,
      was_copied_or_shared: false,
      created_at: createdAt,
      updated_at: createdAt,
    });

    return json(
      {
        generationId: generationId.toString(),
        createdAt,
        emailSubject: output.email_subject,
        emailBody: output.email_body,
        linkedinMessage: output.linkedin_message,
        companyResearch: companyResearch || null,
      },
      { status: 201 }
    );
  } catch (e) {
    return handleError(e);
  }
}
