import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { requireUser } from '@/lib/server/auth';
import { getCollections } from '@/lib/server/db/mongodb';
import { callBedrockJSON } from '@/lib/server/services/bedrock';
import { MESSAGE_GENERATE_SYSTEM_PROMPT, buildMessageGeneratePrompt } from '@/lib/server/prompts/messageGenerate';
import { json, options, handleError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rateLimit';

const TONES = ['formal', 'warm_professional', 'direct_concise', 'enthusiastic'];
const schema = z.object({
  jobUrl: z.string().url().optional(),
  jdRawText: z.string().min(50),
  jdStructured: z.record(z.any()),
  sourceDomain: z.string().optional(),
  tone: z.enum(TONES),
  companyResearch: z.record(z.any()).optional().nullable(),
});

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

function escapeRegex(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(request) {
  try {
    const uid = requireUser(request);

    const limiter = rateLimit(request, { limit: 15, windowMs: 60000, keyPrefix: `gen_${uid}` });
    if (!limiter.success) {
      return json({ error: 'rate_limited', message: 'Rate limit exceeded. Please wait a minute before generating again.' }, { status: 429 });
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

    const company = (body.jdStructured?.company || '').trim();
    console.log(`[api/generate] Starting outreach generation for "${company}" (Tone: ${body.tone}, Has Research: ${Boolean(body.companyResearch)})`);

    const output = await callBedrockJSON(
      MESSAGE_GENERATE_SYSTEM_PROMPT,
      buildMessageGeneratePrompt({
        jdStructured: body.jdStructured,
        profile: profileContext,
        playbookExamples: examples.map((r) => r.example_text),
        tone: body.tone,
        companyResearch: body.companyResearch || null,
      })
    );
    console.log(`[api/generate] Bedrock outreach message generated successfully.`);

    let previous = null;
    if (company) {
      const safeRegex = escapeRegex(company);
      if (safeRegex) {
        previous = await generations.findOne(
          { user_id: uid, company_name: { $regex: `^${safeRegex}$`, $options: 'i' } },
          { sort: { created_at: -1 } }
        );
      }
    }

    const generationId = new ObjectId();
    const createdAt = new Date();
    await generations.insertOne({
      _id: generationId,
      user_id: uid,
      job_url: body.jobUrl || null,
      jd_raw_text: body.jdRawText,
      jd_structured: body.jdStructured,
      fetch_status: body.jobUrl ? 'ok' : 'manual_paste',
      fetch_source_domain: body.sourceDomain || null,
      tone: body.tone,
      company_research: body.companyResearch || null,
      email_subject: output.email_subject,
      email_output: output.email_body,
      linkedin_output: output.linkedin_message,
      company_name: company || null,
      role_title: body.jdStructured.role_title || null,
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
        companyResearch: body.companyResearch || null,
        duplicateWarning: previous
          ? { previousGenerationId: previous._id.toString(), previousDate: previous.created_at }
          : null,
      },
      { status: 201 }
    );
  } catch (e) {
    return handleError(e);
  }
}
