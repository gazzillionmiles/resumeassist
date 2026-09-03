import { tavily } from '@tavily/core';
import { config } from '../config.js';
import { recordExternalApiCall } from './externalApiUsage.js';

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
 * Searches recent news and developments for a given company and tracks usage and latency.
 *
 * @param {object} params
 * @param {string} params.company - Target company name
 * @param {string} [params.roleTitle] - Optional role title for added context
 * @param {string} [params.userId] - User ID for attribution
 * @param {string} [params.generationId] - Generation ID for attribution
 * @returns {Promise<Array<{ title: string, url: string, content: string, score: number, favicon?: string }>>}
 */
export async function searchCompanyNews({ company, roleTitle, userId = null, generationId = null }) {
  if (!company || typeof company !== 'string' || !company.trim()) {
    return [];
  }

  const client = getTavilyClient();
  const cleanCompany = company.trim();
  const query = `${cleanCompany} company recent news initiatives products developments`;

  if (!client) {
    console.warn('[tavily] No TAVILY_API_KEY configured. Skipping search.');
    return [];
  }

  console.log(`[tavily] Executing search for company: "${cleanCompany}"`);
  console.log(`[tavily] Search query: "${query}"`);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const startDate = threeMonthsAgo.toISOString().split('T')[0];

  const startedAt = new Date();
  const startMs = Date.now();

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

    const completedAt = new Date();
    const latencyMs = Date.now() - startMs;
    const results = response?.results || [];

    await recordExternalApiCall({
      userId,
      generationId,
      provider: 'tavily',
      operation: 'tavily_search',
      endpoint: 'client.search',
      itemsCount: 1, // 1 search query
      latencyMs,
      status: 'success',
      startedAt,
      completedAt,
      metadata: {
        company: cleanCompany,
        roleTitle: roleTitle || null,
        results_count: results.length,
        search_depth: 'basic',
      },
    });

    console.log(`[tavily] Search completed in ${latencyMs}ms. Found ${results.length} results for "${cleanCompany}"`);

    return results.map((item) => ({
      title: item.title || '',
      url: item.url || '',
      content: item.content || '',
      score: item.score ?? 0,
      favicon: item.favicon || null,
    }));
  } catch (err) {
    const completedAt = new Date();
    const latencyMs = Date.now() - startMs;

    await recordExternalApiCall({
      userId,
      generationId,
      provider: 'tavily',
      operation: 'tavily_search',
      endpoint: 'client.search',
      itemsCount: 1,
      latencyMs,
      status: 'error',
      errorMessage: err.message || 'Tavily search failed',
      startedAt,
      completedAt,
      metadata: {
        company: cleanCompany,
        roleTitle: roleTitle || null,
      },
    });

    console.error(`[tavily] Search failed for "${cleanCompany}":`, err.message || err);
    return [];
  }
}
