import { TinyFish } from '@tiny-fish/sdk';
import { config } from '../config.js';
import { recordExternalApiCall } from './externalApiUsage.js';
import {
  isLinkedInJobUrl,
  fetchLinkedInGuestJob,
  validateExtractedJob,
} from './linkedinGuest.js';

const MIN_USABLE_LENGTH = 100; // chars
const BLOCK_PAGE_SIGNALS = [
  'sign in to continue',
  'join linkedin',
  'verify you are human',
  'enable javascript',
  'captcha',
  'access denied',
  'this content isn\u2019t available right now',
];

export class FetchBlockedError extends Error {
  constructor(reason, domain) {
    super(`TinyFish fetch blocked: ${reason}`);
    this.name = 'FetchBlockedError';
    this.reason = reason; // 'login_wall' | 'empty' | 'unknown_block' | 'api_error'
    this.domain = domain;
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

let tinyFishClient = null;

function getClient() {
  const apiKey = config.tinyfish.apiKey || process.env.TINYFISH_API_KEY;
  if (!tinyFishClient) {
    tinyFishClient = new TinyFish({ apiKey });
  }
  return tinyFishClient;
}

/**
 * Attempts the LinkedIn guest endpoint fallback strictly when TinyFish fails on a LinkedIn job URL.
 *
 * @param {string} url
 * @param {object} opts
 * @param {string} fallbackReason
 * @returns {Promise<{ rawText: string, domain: string, title: string, company?: string, location?: string, description?: string, sourceUrl?: string, provider: string } | null>}
 */
async function tryLinkedInFallback(url, opts, fallbackReason) {
  if (!isLinkedInJobUrl(url)) {
    return null;
  }

  console.log(`[tinyfish] TinyFish extraction failed (${fallbackReason}). Attempting LinkedIn guest fallback for: ${url}`);
  try {
    const fallbackResult = await fetchLinkedInGuestJob(url, opts);
    if (fallbackResult && validateExtractedJob(fallbackResult)) {
      console.log(`[tinyfish] ✓ LinkedIn guest fallback succeeded for: ${url}`);
      return fallbackResult;
    }
  } catch (fallbackErr) {
    console.warn(`[tinyfish] LinkedIn guest fallback failed: ${fallbackErr.message}`);
  }
  return null;
}

/**
 * Strictly fetch + extract a job posting URL via TinyFish Fetch API.
 * Uses official @tiny-fish/sdk client.fetch.getContents.
 * If TinyFish fails on a LinkedIn job URL, falls back to the LinkedIn guest job endpoint.
 *
 * @param {string} url - Target job posting URL
 * @param {{ userId?: string, generationId?: string, client?: any, fetchFn?: Function }} [opts]
 * @returns {Promise<{ rawText: string, domain: string, title: string, company?: string, location?: string, description?: string, sourceUrl?: string, provider: string }>}
 */
export async function fetchJobPosting(url, opts = {}) {
  const domain = domainOf(url);
  const client = opts.client || getClient();
  const startedAt = new Date();
  const startMs = Date.now();

  let response;
  try {
    console.log(`[tinyfish] Fetching job posting from: ${url}`);
    console.log(`[tinyfish] Domain detected: ${domain}`);
    console.log(`[tinyfish] Using SDK client.fetch.getContents() for single URL`);

    response = await client.fetch.getContents({
      urls: [url],
      format: 'markdown',
      purpose: 'Extract job description, requirements, company and role details from job posting',
    });

    console.log(`[tinyfish] SDK response received. Results: ${response.results?.length || 0}, Errors: ${response.errors?.length || 0}`);
  } catch (err) {
    const completedAt = new Date();
    const latencyMs = Date.now() - startMs;

    await recordExternalApiCall({
      userId: opts.userId,
      generationId: opts.generationId,
      provider: 'tinyfish',
      operation: 'tinyfish_jd_fetch',
      endpoint: 'client.fetch.getContents',
      itemsCount: 1, // 1 URL
      latencyMs,
      status: 'error',
      errorMessage: err.message || 'fetch_failed',
      startedAt,
      completedAt,
      metadata: { url, domain },
    });

    console.error(`[tinyfish] SDK fetch failed for ${url}`);
    console.error(`[tinyfish] Error: ${err.message}`);

    if (isLinkedInJobUrl(url)) {
      const fallbackResult = await tryLinkedInFallback(url, opts, err.message || 'fetch_failed');
      if (fallbackResult) {
        return fallbackResult;
      }
    }

    const error = new FetchBlockedError(err.message || 'fetch_failed', domain);
    error.cause = err;
    throw error;
  }

  const completedAt = new Date();
  const latencyMs = Date.now() - startMs;

  if (Array.isArray(response.errors) && response.errors.length > 0) {
    const errItem = response.errors[0];
    const errorMsg =
      typeof errItem === 'string'
        ? errItem
        : errItem.error || errItem.message || 'fetch_failed';

    await recordExternalApiCall({
      userId: opts.userId,
      generationId: opts.generationId,
      provider: 'tinyfish',
      operation: 'tinyfish_jd_fetch',
      endpoint: 'client.fetch.getContents',
      itemsCount: 1,
      latencyMs,
      status: 'error',
      errorMessage: errorMsg,
      startedAt,
      completedAt,
      metadata: { url, domain },
    });

    if (isLinkedInJobUrl(url)) {
      const fallbackResult = await tryLinkedInFallback(url, opts, errorMsg);
      if (fallbackResult) {
        return fallbackResult;
      }
    }

    throw new FetchBlockedError(errorMsg, domain);
  }

  const result = response.results?.[0];
  const rawText = (result?.text || '').trim();

  await recordExternalApiCall({
    userId: opts.userId,
    generationId: opts.generationId,
    provider: 'tinyfish',
    operation: 'tinyfish_jd_fetch',
    endpoint: 'client.fetch.getContents',
    itemsCount: 1,
    latencyMs,
    status: 'success',
    startedAt,
    completedAt,
    metadata: {
      url,
      domain,
      title: result?.title || '',
      text_length: rawText.length,
    },
  });

  console.log(`[tinyfish] Extracted text length: ${rawText.length} characters in ${latencyMs}ms`);

  const lower = rawText.toLowerCase();
  const hasBlockSignal = BLOCK_PAGE_SIGNALS.some((signal) => lower.includes(signal));
  const isTooShort = !rawText || rawText.length < MIN_USABLE_LENGTH;

  if (hasBlockSignal || isTooShort) {
    if (hasBlockSignal) {
      console.warn(`[tinyfish] Blocked page signals detected`);
    }
    if (isTooShort) {
      console.warn(`[tinyfish] Content too short (${rawText.length} chars, minimum: ${MIN_USABLE_LENGTH})`);
    }

    if (isLinkedInJobUrl(url)) {
      const fallbackResult = await tryLinkedInFallback(
        url,
        opts,
        hasBlockSignal ? 'login_wall' : 'content_too_short'
      );
      if (fallbackResult) {
        return fallbackResult;
      }
    }

    if (hasBlockSignal) {
      throw new FetchBlockedError('login_wall', domain);
    }
    throw new FetchBlockedError('empty', domain);
  }

  console.log(`[tinyfish] ✓ Job posting successfully extracted from ${domain}`);

  return {
    rawText,
    domain,
    title: result?.title || '',
    sourceUrl: url,
    provider: 'tinyfish',
  };
}

/**
 * Fetch and extract multiple company news/article URLs via TinyFish Fetch API.
 * Uses official @tiny-fish/sdk client.fetch.getContents in parallel.
 *
 * @param {string[]} urls - List of URLs (up to 5)
 * @param {{ userId?: string, generationId?: string }} [opts]
 * @returns {Promise<Array<{ url: string, title: string, text: string }>>}
 */
export async function fetchCompanySources(urls, opts = {}) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const client = getClient();
  const validUrls = urls.filter((u) => typeof u === 'string' && u.trim().length > 0);

  if (validUrls.length === 0) {
    return [];
  }

  console.log(`[tinyfish] === BATCH FETCH STARTED ===`);
  console.log(`[tinyfish] URLs to fetch (${validUrls.length}):`);
  validUrls.forEach((u, idx) => {
    console.log(`  ${idx + 1}. ${u}`);
  });

  const startedAt = new Date();
  const startMs = Date.now();

  try {
    const response = await client.fetch.getContents({
      urls: validUrls,
      format: 'markdown',
      purpose: 'Extract full text from company news articles and recent developments for outreach research',
    });

    const completedAt = new Date();
    const latencyMs = Date.now() - startMs;

    console.log(`[tinyfish] SDK response received in ${latencyMs}ms:`);
    console.log(`  - Total results: ${response.results?.length || 0}`);
    console.log(`  - Total errors: ${response.errors?.length || 0}`);

    if (response.errors && response.errors.length > 0) {
      console.warn(`[tinyfish] Some URLs failed to fetch:`);
      response.errors.forEach((err, idx) => {
        console.warn(`  ${idx + 1}. Error: ${typeof err === 'string' ? err : err.error || err.message || 'unknown'}`);
      });
    }

    const results = (response.results || [])
      .map((item) => ({
        url: item.url || '',
        title: item.title || '',
        text: (item.text || '').trim(),
      }))
      .filter((item) => item.text.length >= MIN_USABLE_LENGTH);

    await recordExternalApiCall({
      userId: opts.userId,
      generationId: opts.generationId,
      provider: 'tinyfish',
      operation: 'tinyfish_company_sources_fetch',
      endpoint: 'client.fetch.getContents',
      itemsCount: validUrls.length, // URL count
      latencyMs,
      status: results.length > 0 ? 'success' : 'partial_or_empty',
      startedAt,
      completedAt,
      metadata: {
        requested_count: validUrls.length,
        extracted_count: results.length,
        errors_count: response.errors?.length || 0,
      },
    });

    console.log(`[tinyfish] === BATCH FETCH COMPLETED ===`);
    console.log(`[tinyfish] Successfully extracted ${results.length}/${validUrls.length} articles`);

    return results;
  } catch (err) {
    const completedAt = new Date();
    const latencyMs = Date.now() - startMs;

    await recordExternalApiCall({
      userId: opts.userId,
      generationId: opts.generationId,
      provider: 'tinyfish',
      operation: 'tinyfish_company_sources_fetch',
      endpoint: 'client.fetch.getContents',
      itemsCount: validUrls.length,
      latencyMs,
      status: 'error',
      errorMessage: err.message || 'Batch fetch failed',
      startedAt,
      completedAt,
      metadata: { requested_count: validUrls.length },
    });

    console.error(`[tinyfish] Batch fetch failed:`, err.message || err);
    return [];
  }
}

/**
 * Executes a web / people search query via TinyFish Search API.
 * Uses official @tiny-fish/sdk client.search.query.
 *
 * @param {string} query - Search query string
 * @param {object} [params]
 * @param {string} [params.purpose] - Purpose statement for intent ranking
 * @param {string} [params.includeDomains] - Optional include_domains filter
 * @param {string} [params.userId] - User ID for attribution
 * @param {string} [params.generationId] - Generation ID for attribution
 * @param {any} [params.client] - Injected client for testing
 * @returns {Promise<Array<{ title: string, url: string, snippet: string, site_name?: string }>>}
 */
export async function searchTinyFish(query, params = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const client = params.client || getClient();
  const cleanQuery = query.trim();
  const purpose =
    params.purpose ||
    'Find relevant talent acquisition, recruiting, and HR professionals associated with the target company';
  const startedAt = new Date();
  const startMs = Date.now();

  try {
    console.log(`[tinyfish] Executing search query: "${cleanQuery}"`);
    const searchArgs = {
      query: cleanQuery,
      purpose,
    };
    if (params.includeDomains) {
      searchArgs.include_domains = params.includeDomains;
    }

    const response = await client.search.query(searchArgs);
    const completedAt = new Date();
    const latencyMs = Date.now() - startMs;
    const results = response?.results || [];

    await recordExternalApiCall({
      userId: params.userId,
      generationId: params.generationId,
      provider: 'tinyfish',
      operation: 'tinyfish_people_search',
      endpoint: 'client.search.query',
      itemsCount: 1,
      latencyMs,
      status: 'success',
      startedAt,
      completedAt,
      metadata: {
        query: cleanQuery,
        results_count: results.length,
      },
    });

    console.log(`[tinyfish] Search returned ${results.length} results in ${latencyMs}ms`);

    return results.map((r) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.snippet || '',
      site_name: r.site_name || '',
    }));
  } catch (err) {
    const completedAt = new Date();
    const latencyMs = Date.now() - startMs;

    await recordExternalApiCall({
      userId: params.userId,
      generationId: params.generationId,
      provider: 'tinyfish',
      operation: 'tinyfish_people_search',
      endpoint: 'client.search.query',
      itemsCount: 1,
      latencyMs,
      status: 'error',
      errorMessage: err.message || 'TinyFish search failed',
      startedAt,
      completedAt,
      metadata: { query: cleanQuery },
    });

    console.warn(`[tinyfish] Search failed for "${cleanQuery}":`, err.message || err);
    return [];
  }
}

