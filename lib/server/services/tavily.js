import { tavily } from '@tavily/core';
import { config } from '../config.js';

let tavilyClient = null;

function getTavilyClient() {
  const apiKey = config.tavily.apiKey || process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!tavilyClient) {
    tavilyClient = tavily({ apiKey });
  }
  return tavilyClient;
}

/**
 * Searches recent news and developments for a given company.
 * Cost: 1 credit (using search_depth: 'basic').
 *
 * @param {object} params
 * @param {string} params.company - Target company name
 * @param {string} [params.roleTitle] - Optional role title for added context
 * @returns {Promise<Array<{ title: string, url: string, content: string, score: number, favicon?: string }>>}
 */
export async function searchCompanyNews({ company, roleTitle }) {
  if (!company || typeof company !== 'string' || !company.trim()) {
    return [];
  }

  const client = getTavilyClient();
  const cleanCompany = company.trim();
  const query = `${cleanCompany} company recent news initiatives products developments`;

  if (!client) {
    // If no Tavily key configured, fall back to empty results gracefully
    console.warn('[tavily] No TAVILY_API_KEY configured. Skipping search.');
    return [];
  }

  console.log(`[tavily] Executing search for company: "${cleanCompany}"`);
  console.log(`[tavily] Search query: "${query}"`);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const startDate = threeMonthsAgo.toISOString().split('T')[0];

  console.log(`[tavily] Search params: depth=basic, startDate=${startDate} (past 3 months), maxResults=5`);

  try {
    const response = await client.search(query, {
      searchDepth: 'basic',
      topic: 'general',
      startDate,
      maxResults: 5,
      includeAnswer: false,
      includeRawContent: false,
      includeFavicon: true,
    });

    const results = response?.results || [];
    console.log(`[tavily] Search completed. Found ${results.length} results for "${cleanCompany}"`);
    
    if (results.length > 0) {
      console.log(`[tavily] Top sources discovered:`);
      results.slice(0, 5).forEach((item, idx) => {
        console.log(`  ${idx + 1}. "${item.title || 'Untitled'}"`);
        console.log(`     URL: ${item.url}`);
        console.log(`     Score: ${item.score ?? 0}`);
        console.log(`     Content preview: ${(item.content || '').substring(0, 100)}...`);
      });
    } else {
      console.log(`[tavily] No results found for "${cleanCompany}"`);
    }
    
    return results.map((item) => ({
      title: item.title || '',
      url: item.url || '',
      content: item.content || '',
      score: item.score ?? 0,
      favicon: item.favicon || null,
    }));
  } catch (err) {
    console.error(`[tavily] Search failed for "${cleanCompany}":`, err.message || err);
    console.error(`[tavily] Error details:`, err);
    return [];
  }
}
