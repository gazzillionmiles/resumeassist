import { z } from 'zod';
import { requireVerifiedUser } from '@/lib/server/auth';
import {
  fetchJobPosting,
  FetchBlockedError,
} from '@/lib/server/services/tinyfish';
import { searchCompanyNews } from '@/lib/server/services/tavily';
import { callBedrockJSON } from '@/lib/server/services/bedrock';
import {
  JD_STRUCTURE_SYSTEM_PROMPT,
  buildJDStructurePrompt,
} from '@/lib/server/prompts/jdStructure';
import { json, options, handleError } from '@/lib/server/http';

const schema = z
  .object({
    jobUrl: z.string().url().optional(),
    jdRawText: z.string().min(50).optional(),
  })
  .refine((d) => d.jobUrl || d.jdRawText, {
    message: 'Either jobUrl or jdRawText is required',
  });

export const runtime = 'nodejs';
export async function OPTIONS() {
  return options();
}

export async function POST(request) {
  try {
    await requireVerifiedUser(request);
    const { jobUrl, jdRawText } = schema.parse(await request.json());
    let rawText = jdRawText;
    let sourceDomain = null;

    if (!rawText && jobUrl) {
      const fetched = await fetchJobPosting(jobUrl);
      console.log('Fetched job posting:', fetched);
      rawText = fetched.rawText;
      sourceDomain = fetched.domain;
    }

    if (!rawText || rawText.trim().length < 50) {
      return json({ error: 'insufficient_text' }, { status: 400 });
    }

    const jdStructured = await callBedrockJSON(
      JD_STRUCTURE_SYSTEM_PROMPT,
      buildJDStructurePrompt(rawText)
    );

    if (jdStructured.error === 'not_a_job_posting') {
      return json(
        {
          error: 'not_a_job_posting',
          message:
            "That doesn't look like a job posting. Paste the job description text instead.",
        },
        { status: 422 }
      );
    }

    const company = (jdStructured?.company || '').trim();
    let sources = [];
    if (company && company.toLowerCase() !== 'unknown') {
      console.log(`[api/generate/jd] === COMPANY DETECTED: "${company}" ===`);
      console.log(`[api/generate/jd] Role: ${jdStructured.role_title || 'Unknown'}`);
      console.log(`[api/generate/jd] Initiating Tavily search for company news...`);
      
      try {
        sources = await searchCompanyNews({
          company,
          roleTitle: jdStructured.role_title || '',
        });
        
        console.log(`[api/generate/jd] === TAVILY RESULTS ===`);
        console.log(`[api/generate/jd] Total sources returned: ${sources.length}`);
        
        if (sources.length > 0) {
          console.log(`[api/generate/jd] Sources will be passed to frontend for user selection:`);
          sources.forEach((source, idx) => {
            console.log(`  ${idx + 1}. "${source.title}"`);
            console.log(`     URL: ${source.url}`);
            console.log(`     Relevance Score: ${source.score}`);
          });
        } else {
          console.log(`[api/generate/jd] ⚠ No sources found for "${company}"`);
        }
      } catch (searchErr) {
        console.error(`[api/generate/jd] ✗ Tavily search failed:`, searchErr.message);
        console.error(`[api/generate/jd] Search params - company: "${company}", roleTitle: "${jdStructured.role_title || ''}"`);
      }
    } else {
      console.log(`[api/generate/jd] ⚠ No company detected or company="unknown" - skipping Tavily search`);
    }

    return json({ jdRawText: rawText, jdStructured, sourceDomain, sources });
  } catch (e) {
    if (e instanceof FetchBlockedError) e.name = 'FetchBlockedError';
    return handleError(e);
  }
}
