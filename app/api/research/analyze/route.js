import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { getCollections } from '@/lib/server/db/mongodb';
import { fetchCompanySources } from '@/lib/server/services/tinyfish';
import { callBedrockJSON } from '@/lib/server/services/bedrock';
import {
  COMPANY_RESEARCH_SYSTEM_PROMPT,
  buildCompanyResearchPrompt,
} from '@/lib/server/prompts/companyResearch';
import { json, options, handleError } from '@/lib/server/http';

const schema = z.object({
  company: z.string().min(1),
  roleTitle: z.string().optional(),
  jdStructured: z.record(z.any()).optional(),
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
    })
  ).default([]),
});

export const runtime = 'nodejs';
export async function OPTIONS() {
  return options();
}

export async function POST(request) {
  try {
    const uid = requireUser(request);
    const { company, roleTitle, jdStructured, sources } = schema.parse(await request.json());
    console.log(`[api/research/analyze] Analyzing ${sources.length} sources for company: "${company}"`);

    const { profiles } = await getCollections();
    const profile = await profiles.findOne({ user_id: uid });

    const profileContext = profile ? {
      current_title: profile.current_title ?? profile.currentTitle ?? '',
      location: profile.location ?? '',
      work_auth: profile.work_auth ?? profile.workAuth ?? '',
      resume: profile.resume_structured ?? null,
    } : {};

    const urlsToFetch = sources.map((s) => s.url).filter(Boolean);
    let fetchedArticles = [];

    if (urlsToFetch.length > 0) {
      console.log(`[api/research/analyze] === TINYFISH FETCH STAGE ===`);
      console.log(`[api/research/analyze] URLs selected by user for deep analysis: ${urlsToFetch.length}`);
      
      try {
        console.log(`[api/research/analyze] URLs to fetch:`);
        urlsToFetch.forEach((url, idx) => {
          console.log(`  ${idx + 1}. ${url}`);
        });
        
        const fetched = await fetchCompanySources(urlsToFetch);
        
        console.log(`[api/research/analyze] === TINYFISH RESULTS ===`);
        console.log(`[api/research/analyze] Successfully extracted: ${fetched.length}/${urlsToFetch.length} articles`);
        
        // Merge fetched results with source metadata
        fetchedArticles = urlsToFetch.map((url) => {
          const matchFetched = fetched.find((f) => f.url === url);
          const matchSource = sources.find((s) => s.url === url);
          return {
            url,
            title: matchFetched?.title || matchSource?.title || 'Article',
            text: matchFetched?.text || matchSource?.content || '',
          };
        });
        
        console.log(`[api/research/analyze] Merged article data:`);
        fetchedArticles.forEach((article, idx) => {
          console.log(`  ${idx + 1}. "${article.title}"`);
          console.log(`     URL: ${article.url}`);
          console.log(`     Final text length: ${article.text.length} chars`);
        });
      } catch (err) {
        console.warn(`[api/research/analyze] ✗ TinyFish fetch failed: ${err.message}`);
        console.warn(`[api/research/analyze] Falling back to Tavily snippets only (${sources.length} sources)`);
        fetchedArticles = sources.map((s) => ({
          url: s.url,
          title: s.title || 'Article',
          text: s.content || '',
        }));
      }
    } else {
      console.log(`[api/research/analyze] No URLs to fetch - skipping TinyFish stage`);
    }

    console.log(`[api/research/analyze] === BEDROCK LLM ANALYSIS STAGE ===`);
    console.log(`[api/research/analyze] Company: "${company}", Role: "${roleTitle || 'Unknown'}"`);
    console.log(`[api/research/analyze} Articles to analyze: ${fetchedArticles.length}`);
    console.log(`[api/research/analyze] Running Bedrock Claude for research synthesis...`);
    
    const research = await callBedrockJSON(
      COMPANY_RESEARCH_SYSTEM_PROMPT,
      buildCompanyResearchPrompt({
        company,
        roleTitle,
        jdStructured,
        profile: profileContext,
        articles: fetchedArticles,
      })
    );
    
    console.log(`[api/research/analyze] === BEDROCK ANALYSIS COMPLETE ===`);
    console.log(`[api/research/analyze] Research output generated:`);
    console.log(`  - Conversation hook: ${research.conversation_hook ? 'Yes' : 'No'}`);
    console.log(`  - Candidate connection: ${research.candidate_connection ? 'Yes' : 'No'}`);
    console.log(`  - Recent developments: ${research.recent_developments?.length || 0} items`);
    console.log(`  - Sources used: ${research.sources_used?.length || 0} sources`);

    return json({ research });
  } catch (e) {
    console.error('[api/research/analyze] Error:', e.message);
    return handleError(e);
  }
}
