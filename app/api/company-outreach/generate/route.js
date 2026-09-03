import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { requireVerifiedUser } from '../../../../lib/server/auth.js';
import { getCollections } from '../../../../lib/server/db/mongodb.js';
import { callBedrockJSON } from '../../../../lib/server/services/bedrock.js';
import { fetchCompanySources } from '../../../../lib/server/services/tinyfish.js';
import { searchCompanyNews } from '../../../../lib/server/services/tavily.js';
import { finalizeGenerationAccounting } from '../../../../lib/server/services/generationAccounting.js';
import {
  reserveGenerationCredit,
  confirmGenerationCredit,
  refundGenerationCredit,
} from '../../../../lib/server/services/credits.js';
import {
  COMPANY_OUTREACH_RESEARCH_SYSTEM_PROMPT,
  buildCompanyOutreachResearchPrompt,
} from '../../../../lib/server/prompts/companyResearch.js';
import {
  COMPANY_OUTREACH_MESSAGE_SYSTEM_PROMPT,
  buildCompanyOutreachMessagePrompt,
} from '../../../../lib/server/prompts/messageGenerate.js';
import { json, options, handleError } from '../../../../lib/server/http.js';
import { rateLimit } from '../../../../lib/server/rateLimit.js';

const TONES = ['formal', 'warm_professional', 'direct_concise', 'enthusiastic'];

const personSchema = z.object({
  name: z.string().min(1, 'Person name is required'),
  title: z.string().optional().default('Talent Acquisition'),
  company: z.string().optional(),
  profile_url: z.string().optional().default(''),
  source_url: z.string().optional().default(''),
  relevance_reason: z.string().optional().default(''),
  location: z.string().optional(),
  department: z.string().optional(),
  specialization: z.string().optional(),
  current_employee_verified: z.boolean().optional(),
  recruiting_relevance: z.string().optional(),
  verification_reason: z.string().optional(),
  score: z.number().optional(),
  confidence: z.number().optional(),
});

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  selectedPeople: z.array(personSchema).min(1, 'At least one target person must be selected'),
  candidateProfile: z.record(z.any()).optional().nullable(),
  companyResearch: z.record(z.any()).optional().nullable(),
  tone: z.enum(TONES).optional().default('warm_professional'),
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

    const limiter = rateLimit(request, { limit: 15, windowMs: 60000, keyPrefix: `cog_${uid}` });
    if (!limiter.success) {
      return json(
        { error: 'rate_limited', message: 'Rate limit exceeded. Please wait a minute before generating again.' },
        { status: 429 }
      );
    }

    const body = schema.parse(await request.json());
    const cleanCompany = body.companyName.trim();
    const primaryPerson = body.selectedPeople[0];

    const { profiles, playbookExamples, generations } = await getCollections();
    const profileDoc = await profiles.findOne({ user_id: uid });

    const profileContext = body.candidateProfile || {
      current_title: profileDoc?.current_title ?? profileDoc?.currentTitle ?? '',
      current_ctc: profileDoc?.current_ctc ?? profileDoc?.currentCtc ?? '',
      expected_ctc: profileDoc?.expected_ctc ?? profileDoc?.expectedCtc ?? '',
      notice_period: profileDoc?.notice_period ?? profileDoc?.noticePeriod ?? '',
      location: profileDoc?.location ?? '',
      resume: profileDoc?.resume_structured ?? null,
    };

    const examples = await playbookExamples.find({ user_id: uid }).sort({ created_at: -1 }).limit(3).toArray();

    generationId = new ObjectId();
    const generationIdStr = generationId.toString();

    // 0. Server-Side Credit Enforcement & Reservation (Prior to expensive vendor/LLM calls)
    creditReservation = await reserveGenerationCredit({
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

    console.log(`[api/company-outreach/generate] Starting Company Outreach Generation for "${cleanCompany}"`);
    console.log(`[api/company-outreach/generate] Target Person: ${primaryPerson.name} (${primaryPerson.title})`);

    // 1. Company Research (Tavily search + TinyFish full text + Bedrock synthesis) if not provided
    let companyResearch = body.companyResearch || null;

    if (!companyResearch) {
      console.log(`[api/company-outreach/generate] Stage 1: Conducting company research on "${cleanCompany}"...`);
      try {
        const tavilyStart = Date.now();
        const tavilySources = await searchCompanyNews({
          company: cleanCompany,
          userId: uid,
          generationId: generationIdStr,
        });
        stages.tavily_search = {
          latency_ms: Date.now() - tavilyStart,
          status: 'completed',
          results_count: tavilySources.length,
        };

        let fetchedArticles = [];
        const urlsToFetch = tavilySources.slice(0, 4).map((s) => s.url).filter(Boolean);

        if (urlsToFetch.length > 0) {
          try {
            console.log(`[api/company-outreach/generate] Fetching full text for ${urlsToFetch.length} sources via TinyFish...`);
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
            console.warn(`[api/company-outreach/generate] TinyFish fetch warning: ${tinyFishErr.message}`);
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

        console.log(`[api/company-outreach/generate] Stage 2: Synthesizing company developments & candidate connection with Bedrock...`);
        const researchStart = Date.now();
        const rawResearch = await callBedrockJSON(
          COMPANY_OUTREACH_RESEARCH_SYSTEM_PROMPT,
          buildCompanyOutreachResearchPrompt({
            company: cleanCompany,
            profile: profileContext,
            articles: fetchedArticles,
          }),
          { userId: uid, generationId: generationIdStr, action: 'company_outreach_research' }
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
          company_name: rawResearch.company_name || cleanCompany,
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
      } catch (researchErr) {
        console.warn(`[api/company-outreach/generate] Company research failed: ${researchErr.message}`);
        stages.company_research = { status: 'failed', error: researchErr.message };
      }
    }

    // 2. Generate Personalized Messages (Email & LinkedIn note) for target recipient
    console.log(`[api/company-outreach/generate] Stage 3: Generating personalized messages for ${primaryPerson.name}...`);
    const messageGenStart = Date.now();
    const output = await callBedrockJSON(
      COMPANY_OUTREACH_MESSAGE_SYSTEM_PROMPT,
      buildCompanyOutreachMessagePrompt({
        company: cleanCompany,
        targetPerson: primaryPerson,
        profile: profileContext,
        playbookExamples: examples.map((r) => r.example_text),
        tone: body.tone,
        companyResearch: companyResearch || null,
      }),
      { userId: uid, generationId: generationIdStr, action: 'company_outreach_message_generate' }
    );
    stages.message_generate = {
      latency_ms: Date.now() - messageGenStart,
      status: 'completed',
    };

    // 3. Persist to MongoDB
    const pipelineCompletedAt = new Date();
    const totalLatencyMs = Date.now() - pipelineStartMs;
    const createdAt = new Date();

    const generationDoc = {
      _id: generationId,
      user_id: uid,
      generation_type: 'company_outreach',
      company_name: cleanCompany,
      role_title: primaryPerson.title || 'Talent Acquisition',
      target_people: body.selectedPeople,
      selected_person: primaryPerson,
      fetch_status: 'company_search',
      fetch_source_domain: primaryPerson.profile_url ? new URL(primaryPerson.profile_url).hostname : null,
      tone: body.tone,
      company_research: companyResearch || null,
      email_subject: output.email_subject,
      email_output: output.email_body,
      linkedin_output: output.linkedin_message,
      was_edited: false,
      was_copied_or_shared: false,
      created_at: createdAt,
      updated_at: createdAt,
    };

    await generations.insertOne(generationDoc);

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

    console.log(`[api/company-outreach/generate] Company Outreach ${generationIdStr} completed in ${Math.round(totalLatencyMs / 100) / 10}s. Cost: $${accounting?.costs?.total_generation_cost_usd || 0}`);

    return json(
      {
        generationId: generationIdStr,
        createdAt,
        generation_type: 'company_outreach',
        companyName: cleanCompany,
        selectedPeople: body.selectedPeople,
        selectedPerson: primaryPerson,
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
