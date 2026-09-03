import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { requireVerifiedUser } from '@/lib/server/auth';
import { getCollections } from '@/lib/server/db/mongodb';
import { callBedrockJSON } from '@/lib/server/services/bedrock';
import { fetchJobPosting, fetchCompanySources } from '@/lib/server/services/tinyfish';
import { searchCompanyNews } from '@/lib/server/services/tavily';
import { finalizeGenerationAccounting } from '@/lib/server/services/generationAccounting';
import {
  reserveGenerationCredit,
  confirmGenerationCredit,
  refundGenerationCredit,
} from '@/lib/server/services/credits';
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
  const pipelineStartedAt = new Date();
  const pipelineStartMs = Date.now();
  const stages = {};
  let generationId = null;
  let uid = null;
  let creditReservation = null;

  try {
    uid = await requireVerifiedUser(request);

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

    generationId = new ObjectId();
    const generationIdStr = generationId.toString();

    // 0. Server-Side Credit Enforcement & Reservation (Prior to expensive vendor/LLM calls)
    const creditReservation = await reserveGenerationCredit({
      userId: uid,
      generationId: generationIdStr,
    });

    if (!creditReservation.success) {
      return json(
        {
          error: 'no_credits',
          code: 'NO_CREDITS',
          message: "You've used your 5 free generations. Get more credits to continue creating personalized outreach.",
          credits: 0,
          freeCredits: 0,
          purchasedCredits: 0,
          totalCredits: 0,
        },
        { status: 402 }
      );
    }

    let rawText = (body.jdRawText || '').trim();
    let sourceDomain = body.sourceDomain || null;
    let jdStructured = body.jdStructured || null;

    // 1. Fetch JD from URL if needed
    if (!rawText && body.jobUrl) {
      console.log(`[api/generate] Stage 1: Fetching JD from URL: ${body.jobUrl}`);
      const stageStart = Date.now();
      const fetched = await fetchJobPosting(body.jobUrl, { userId: uid, generationId: generationIdStr });
      rawText = fetched.rawText;
      sourceDomain = fetched.domain;
      stages.jd_fetch = {
        latency_ms: Date.now() - stageStart,
        status: 'completed',
        domain: sourceDomain,
        provider: fetched.provider || 'tinyfish',
      };
    }

    // 2. Parse & Structure JD if not already provided
    if (!jdStructured) {
      if (!rawText || rawText.length < 50) {
        return json({ error: 'insufficient_text', message: 'Job description text must be at least 50 characters.' }, { status: 400 });
      }
      console.log(`[api/generate] Stage 2: Structuring job description with Bedrock...`);
      const stageStart = Date.now();
      jdStructured = await callBedrockJSON(
        JD_STRUCTURE_SYSTEM_PROMPT,
        buildJDStructurePrompt(rawText),
        { userId: uid, generationId: generationIdStr, action: 'jd_structure' }
      );
      stages.jd_structure = {
        latency_ms: Date.now() - stageStart,
        status: 'completed',
      };

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

    // 3. Tavily Deep Company Research & TinyFish Source Fetching
    let companyResearch = body.companyResearch || null;

    if (!companyResearch && company && company.toLowerCase() !== 'unknown') {
      console.log(`[api/generate] Stage 3: Starting Tavily search for "${company}"...`);
      try {
        const tavilyStart = Date.now();
        const tavilySources = await searchCompanyNews({
          company,
          roleTitle,
          userId: uid,
          generationId: generationIdStr,
        });
        stages.tavily_search = {
          latency_ms: Date.now() - tavilyStart,
          status: 'completed',
          results_count: tavilySources.length,
        };
        console.log(`[api/generate] Tavily returned ${tavilySources.length} sources`);

        let fetchedArticles = [];
        const urlsToFetch = tavilySources.slice(0, 4).map((s) => s.url).filter(Boolean);

        if (urlsToFetch.length > 0) {
          try {
            console.log(`[api/generate] Stage 4: Fetching full text for ${urlsToFetch.length} sources via TinyFish...`);
            const tinyfishStart = Date.now();
            const fetched = await fetchCompanySources(urlsToFetch, {
              userId: uid,
              generationId: generationIdStr,
            });
            stages.company_sources_fetch = {
              latency_ms: Date.now() - tinyfishStart,
              status: 'completed',
              urls_requested: urlsToFetch.length,
              urls_extracted: fetched.length,
            };

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
            stages.company_sources_fetch = {
              status: 'fallback_snippets',
              error: tinyFishErr.message,
            };
            fetchedArticles = tavilySources.slice(0, 4).map((s) => ({
              url: s.url,
              title: s.title || 'Article',
              text: s.content || '',
            }));
          }
        }

        console.log(`[api/generate] Stage 5: Running Bedrock research synthesis and interview points extraction...`);
        const researchStart = Date.now();
        const rawResearch = await callBedrockJSON(
          COMPANY_RESEARCH_SYSTEM_PROMPT,
          buildCompanyResearchPrompt({
            company,
            roleTitle,
            jdStructured,
            profile: profileContext,
            articles: fetchedArticles,
          }),
          { userId: uid, generationId: generationIdStr, action: 'company_research' }
        );
        stages.company_research = {
          latency_ms: Date.now() - researchStart,
          status: 'completed',
        };

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
        stages.company_research = { status: 'failed', error: researchErr.message };
      }
    }

    // 4. Generate Outreach Messages (Email & LinkedIn)
    console.log(`[api/generate] Stage 6: Generating outreach messages with Bedrock (Tone: ${body.tone})...`);
    const messageGenStart = Date.now();
    const output = await callBedrockJSON(
      MESSAGE_GENERATE_SYSTEM_PROMPT,
      buildMessageGeneratePrompt({
        jdStructured,
        profile: profileContext,
        playbookExamples: examples.map((r) => r.example_text),
        tone: body.tone,
        companyResearch: companyResearch || null,
      }),
      { userId: uid, generationId: generationIdStr, action: 'message_generate' }
    );
    stages.message_generate = {
      latency_ms: Date.now() - messageGenStart,
      status: 'completed',
    };
    console.log(`[api/generate] Outreach message generated successfully.`);

    // 5. Compute total pipeline wall-clock time and finalize accounting
    const pipelineCompletedAt = new Date();
    const totalLatencyMs = Date.now() - pipelineStartMs;

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

    // Confirm credit consumption and log generation transaction
    await confirmGenerationCredit({
      userId: uid,
      generationId: generationIdStr,
      reservation: creditReservation,
    });

    const accounting = await finalizeGenerationAccounting({
      generationId: generationIdStr,
      userId: uid,
      startedAt: pipelineStartedAt,
      completedAt: pipelineCompletedAt,
      totalLatencyMs,
      stages,
      status: 'completed',
    });

    console.log(`[api/generate] Generation ${generationIdStr} completed in ${Math.round(totalLatencyMs / 100) / 10}s. Total cost: $${accounting?.costs?.total_generation_cost_usd || 0}`);

    return json(
      {
        generationId: generationIdStr,
        createdAt,
        emailSubject: output.email_subject,
        emailBody: output.email_body,
        linkedinMessage: output.linkedin_message,
        companyResearch: companyResearch || null,
        credits: {
          freeCredits: creditReservation.freeCredits,
          purchasedCredits: creditReservation.purchasedCredits,
          totalCredits: creditReservation.totalCredits,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    if (creditReservation?.success && uid) {
      await refundGenerationCredit({
        userId: uid,
        generationId: generationId?.toString(),
        reservation: creditReservation,
        reason: e.message || 'generation_failed',
      }).catch(() => {});
    }

    if (generationId && uid) {
      const pipelineCompletedAt = new Date();
      const totalLatencyMs = Date.now() - pipelineStartMs;
      await finalizeGenerationAccounting({
        generationId: generationId.toString(),
        userId: uid,
        startedAt: pipelineStartedAt,
        completedAt: pipelineCompletedAt,
        totalLatencyMs,
        stages,
        status: 'failed',
        errorMessage: e.message,
      }).catch(() => {});
    }
    return handleError(e);
  }
}
