import { TinyFish } from '@tiny-fish/sdk';
import { config } from '../config.js';

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
 * Strictly fetch + extract a job posting URL via TinyFish Fetch API.
 * Uses official @tiny-fish/sdk client.fetch.getContents.
 *
 * @param {string} url - Target job posting URL
 * @returns {Promise<{ rawText: string, domain: string, title: string }>}
 */
export async function fetchJobPosting(url) {
  const domain = domainOf(url);
  const client = getClient();

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
    console.error(`[tinyfish] SDK fetch failed for ${url}`);
    console.error(`[tinyfish] Error: ${err.message}`);
    console.error(`[tinyfish] Domain: ${domain}`);
    const error = new FetchBlockedError(err.message || 'fetch_failed', domain);
    error.cause = err;
    throw error;
  }

  if (Array.isArray(response.errors) && response.errors.length > 0) {
    const errItem = response.errors[0];
    const errorMsg =
      typeof errItem === 'string'
        ? errItem
        : errItem.error || errItem.message || 'fetch_failed';
    throw new FetchBlockedError(errorMsg, domain);
  }

  const result = response.results?.[0];
  const rawText = (result?.text || '').trim();
  
  console.log(`[tinyfish] Extracted text length: ${rawText.length} characters`);
  console.log(`[tinyfish] First 200 chars preview: "${rawText.substring(0, 200)}..."`);

  if (!rawText || rawText.length < MIN_USABLE_LENGTH) {
    console.warn(`[tinyfish] Content too short (${rawText.length} chars, minimum: ${MIN_USABLE_LENGTH})`);
  }

  const lower = rawText.toLowerCase();
  const hasBlockSignal = BLOCK_PAGE_SIGNALS.some((signal) => lower.includes(signal));

  if (hasBlockSignal) {
    console.warn(`[tinyfish] Blocked page signals detected`);
    throw new FetchBlockedError('login_wall', domain);
  }

  console.log(`[tinyfish] ✓ Job posting successfully extracted from ${domain}`);
  console.log(`[tinyfish] Final text length: ${rawText.length} chars`);

  return {
    rawText,
    domain,
    title: result?.title || '',
  };
}

/**
 * Fetch and extract multiple company news/article URLs via TinyFish Fetch API.
 * Uses official @tiny-fish/sdk client.fetch.getContents in parallel.
 *
 * @param {string[]} urls - List of URLs (up to 5)
 * @returns {Promise<Array<{ url: string, title: string, text: string }>>}
 */
export async function fetchCompanySources(urls) {
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

  try {
    const response = await client.fetch.getContents({
      urls: validUrls,
      format: 'markdown',
      purpose: 'Extract full text from company news articles and recent developments for outreach research',
    });

    console.log(`[tinyfish] SDK response received:`);
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

    console.log(`[tinyfish] === BATCH FETCH COMPLETED ===`);
    console.log(`[tinyfish] Successfully extracted ${results.length}/${validUrls.length} articles`);

    if (results.length > 0) {
      console.log(`[tinyfish] Extracted articles summary:`);
      results.forEach((item, idx) => {
        console.log(`  ${idx + 1}. "${item.title}"`);
        console.log(`     URL: ${item.url}`);
        console.log(`     Text length: ${item.text.length} chars`);
        console.log(`     Preview: "${item.text.substring(0, 150)}..."`);
      });
    }

    return results;
  } catch (err) {
    console.error(`[tinyfish] Batch fetch failed:`, err.message || err);
    return [];
  }
}

