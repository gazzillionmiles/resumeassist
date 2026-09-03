import * as cheerio from 'cheerio';
import { recordExternalApiCall } from './externalApiUsage.js';

const GUEST_API_BASE = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';
const MIN_DESCRIPTION_LENGTH = 100;
const REQUEST_TIMEOUT_MS = 10000;

const BLOCK_SIGNALS = [
  'authwall',
  'sign in to continue',
  'join linkedin',
  'security verification',
  'checkpoint/challenge',
  'captcha',
  'unsupported browser',
  'access denied',
  'verify you are human',
];

/**
 * Checks if a given URL belongs to a valid LinkedIn domain safely.
 * Prevents spoofing like linkedin.com.evil.com.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isLinkedInHost(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

/**
 * Extracts numeric job ID from a LinkedIn job URL.
 * Matches /jobs/view/{JOB_ID} or /jobs/view/slug-{JOB_ID}.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function extractLinkedInJobId(url) {
  if (!isLinkedInHost(url)) return null;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    // Match /jobs/view/4448119707 or /jobs/view/senior-developer-4448119707
    const match = pathname.match(/\/jobs\/view\/(?:[^\/]+-)?(\d+)(?:\/|$)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Determines whether a URL is a valid LinkedIn job URL with an extractable job ID.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isLinkedInJobUrl(url) {
  return extractLinkedInJobId(url) !== null;
}

/**
 * Cleans and converts Cheerio HTML element containing job description into formatted text.
 *
 * @param {cheerio.Cheerio<any>} $el
 * @param {cheerio.Root} $
 * @returns {string}
 */
function extractFormattedText($el, $) {
  if (!$el || $el.length === 0) return '';

  // Clone to avoid modifying original tree
  const clone = $el.clone();

  // Replace common block and list elements with line breaks
  clone.find('br').replaceWith('\n');
  clone.find('p').each((_, p) => {
    $(p).replaceWith(`\n\n${$(p).text().trim()}\n\n`);
  });
  clone.find('li').each((_, li) => {
    $(li).replaceWith(`\n- ${$(li).text().trim()}`);
  });
  clone.find('h1, h2, h3, h4, h5, h6').each((_, h) => {
    $(h).replaceWith(`\n\n### ${$(h).text().trim()}\n\n`);
  });

  return clone
    .text()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses raw HTML returned by the LinkedIn guest job posting endpoint.
 *
 * @param {string} html
 * @param {string} sourceUrl
 * @returns {{
 *   title: string,
 *   company: string,
 *   location: string,
 *   description: string,
 *   criteria: Record<string, string>,
 *   rawText: string,
 *   domain: string,
 *   sourceUrl: string,
 *   provider: string
 * } | null}
 */
export function parseLinkedInGuestJobHtml(html, sourceUrl = '') {
  if (!html || typeof html !== 'string') return null;

  const lowerHtml = html.toLowerCase();
  const hasBlockSignal = BLOCK_SIGNALS.some((sig) => lowerHtml.includes(sig));
  if (hasBlockSignal) {
    return null;
  }

  const $ = cheerio.load(html);

  // 1. Extract Job Title with multiple fallbacks
  const title = (
    $('h2.top-card-layout__title').first().text() ||
    $('h1.top-card-layout__title').first().text() ||
    $('h1.topcard__title').first().text() ||
    $('h2.topcard__title').first().text() ||
    $('[data-tracking-control-name="public_jobs_topcard-title"]').first().text() ||
    $('.sub-nav-cta__header').first().text() ||
    $('h1').first().text() ||
    $('h2').first().text() ||
    ''
  ).trim();

  // 2. Extract Company Name with multiple fallbacks
  const company = (
    $('a.topcard__org-name-link').first().text() ||
    $('.top-card-layout__first-sub-headline a').first().text() ||
    $('a.top-card-layout__company-url').first().text() ||
    $('.topcard__flavor--black-link').first().text() ||
    $('.top-card-layout__first-sub-headline').first().text() ||
    $('span.topcard__flavor').first().text() ||
    $('[data-tracking-control-name="public_jobs_topcard-org-name"]').first().text() ||
    ''
  ).trim();

  // 3. Extract Location with multiple fallbacks
  const location = (
    $('.topcard__flavor--bullet').first().text() ||
    $('.top-card-layout__second-sub-headline').first().text() ||
    $('span.topcard__flavor:not(.topcard__flavor--black-link)').first().text() ||
    $('.top-card-layout__second-sub-headline span').first().text() ||
    ''
  ).trim();

  // 4. Extract Job Criteria (Seniority, Employment Type, Job Function, Industries)
  const criteria = {};
  $('.description__job-criteria-list li, .job-criteria__item').each((_, el) => {
    const header = $(el)
      .find('h3.description__job-criteria-subheader, .job-criteria__subheader')
      .text()
      .trim();
    const value = $(el)
      .find('span.description__job-criteria-text, .job-criteria__text')
      .text()
      .trim();
    if (header && value) {
      criteria[header] = value;
    }
  });

  // 5. Extract Job Description with multiple fallbacks
  let descriptionEl = $('.show-more-less-html__markup');
  if (descriptionEl.length === 0) {
    descriptionEl = $('.description__text');
  }
  if (descriptionEl.length === 0) {
    descriptionEl = $('section.show-more-less-html');
  }
  if (descriptionEl.length === 0) {
    descriptionEl = $('.show-more-less-html');
  }
  if (descriptionEl.length === 0) {
    descriptionEl = $('.decoratedJobPosting__details');
  }

  let description = '';
  if (descriptionEl.length > 0) {
    description = extractFormattedText(descriptionEl.first(), $);
  } else {
    // Fallback: extract body text if specific container is not found
    description = $('body').text().trim();
  }

  // 6. Format rich rawText structured for downstream LLM prompts
  const lines = [];
  if (title) lines.push(`# ${title}`);
  if (company) lines.push(`Company: ${company}`);
  if (location) lines.push(`Location: ${location}`);

  const criteriaKeys = Object.keys(criteria);
  if (criteriaKeys.length > 0) {
    lines.push('\n### Job Criteria');
    criteriaKeys.forEach((key) => {
      lines.push(`- ${key}: ${criteria[key]}`);
    });
  }

  if (description) {
    lines.push('\n### Job Description\n');
    lines.push(description);
  }

  const rawText = lines.join('\n').trim();

  return {
    title,
    company,
    location,
    description,
    criteria,
    rawText,
    domain: 'linkedin.com',
    sourceUrl,
    provider: 'linkedin_guest',
  };
}

/**
 * Validates whether the extracted LinkedIn job data is useful and complete.
 *
 * @param {{ title?: string, description?: string, rawText?: string } | null} jobData
 * @returns {boolean}
 */
export function validateExtractedJob(jobData) {
  if (!jobData) return false;
  const { title, description, rawText } = jobData;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return false;
  }

  if (!description || typeof description !== 'string' || description.trim().length < MIN_DESCRIPTION_LENGTH) {
    return false;
  }

  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < MIN_DESCRIPTION_LENGTH) {
    return false;
  }

  const lowerDesc = description.toLowerCase();
  if (BLOCK_SIGNALS.some((sig) => lowerDesc.includes(sig))) {
    return false;
  }

  return true;
}

/**
 * Fallback fetcher: Requests public LinkedIn guest job posting endpoint for a single job ID.
 * Strictly called ONLY as a fallback when TinyFish fails on a LinkedIn job URL.
 *
 * @param {string} url - LinkedIn job URL
 * @param {{ userId?: string, generationId?: string, fetchFn?: Function }} [opts]
 * @returns {Promise<{
 *   rawText: string,
 *   domain: string,
 *   title: string,
 *   company: string,
 *   location: string,
 *   description: string,
 *   criteria: Record<string, string>,
 *   sourceUrl: string,
 *   provider: string
 * }>}
 */
export async function fetchLinkedInGuestJob(url, opts = {}) {
  const jobId = extractLinkedInJobId(url);
  if (!jobId) {
    throw new Error('invalid_linkedin_job_url');
  }

  const targetEndpoint = `${GUEST_API_BASE}/${jobId}`;
  const startedAt = new Date();
  const startMs = Date.now();
  const fetchImpl = opts.fetchFn || globalThis.fetch;

  console.log(`[linkedin_guest] Attempting guest fallback for job ID: ${jobId} (URL: ${url})`);

  let response;
  let latencyMs = 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    response = await fetchImpl(targetEndpoint, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    latencyMs = Date.now() - startMs;
  } catch (fetchErr) {
    latencyMs = Date.now() - startMs;
    const completedAt = new Date();
    const isTimeout = fetchErr.name === 'AbortError';
    const failureReason = isTimeout ? 'timeout' : (fetchErr.message || 'network_error');

    // Safe debugging log without credentials
    console.error(`[linkedin_guest] Fallback request failed:`, {
      generation_id: opts.generationId || null,
      source_url: url,
      provider: 'linkedin_guest',
      failure_reason: failureReason,
      status_code: null,
      latency_ms: latencyMs,
      timestamp: completedAt.toISOString(),
    });

    await recordExternalApiCall({
      userId: opts.userId,
      generationId: opts.generationId,
      provider: 'linkedin_guest',
      operation: 'linkedin_guest_jd_fetch',
      endpoint: targetEndpoint,
      itemsCount: 1,
      latencyMs,
      status: 'error',
      errorMessage: failureReason,
      startedAt,
      completedAt,
      metadata: { url, jobId, failure_reason: failureReason },
    });

    throw new Error(`linkedin_guest_fetch_failed: ${failureReason}`);
  }

  const completedAt = new Date();
  const statusCode = response.status;

  if (!response.ok) {
    const failureReason = `http_status_${statusCode}`;
    console.error(`[linkedin_guest] Fallback returned non-200 status:`, {
      generation_id: opts.generationId || null,
      source_url: url,
      provider: 'linkedin_guest',
      failure_reason: failureReason,
      status_code: statusCode,
      latency_ms: latencyMs,
      timestamp: completedAt.toISOString(),
    });

    await recordExternalApiCall({
      userId: opts.userId,
      generationId: opts.generationId,
      provider: 'linkedin_guest',
      operation: 'linkedin_guest_jd_fetch',
      endpoint: targetEndpoint,
      itemsCount: 1,
      latencyMs,
      status: 'error',
      errorMessage: failureReason,
      startedAt,
      completedAt,
      metadata: { url, jobId, status_code: statusCode },
    });

    throw new Error(`linkedin_guest_fetch_failed: ${failureReason}`);
  }

  const html = await response.text();
  const parsedData = parseLinkedInGuestJobHtml(html, url);
  const isValid = validateExtractedJob(parsedData);

  if (!isValid || !parsedData) {
    const failureReason = !parsedData ? 'empty_or_blocked_html' : 'validation_failed';
    console.error(`[linkedin_guest] Fallback content validation failed:`, {
      generation_id: opts.generationId || null,
      source_url: url,
      provider: 'linkedin_guest',
      failure_reason: failureReason,
      status_code: statusCode,
      latency_ms: latencyMs,
      timestamp: completedAt.toISOString(),
    });

    await recordExternalApiCall({
      userId: opts.userId,
      generationId: opts.generationId,
      provider: 'linkedin_guest',
      operation: 'linkedin_guest_jd_fetch',
      endpoint: targetEndpoint,
      itemsCount: 1,
      latencyMs,
      status: 'error',
      errorMessage: failureReason,
      startedAt,
      completedAt,
      metadata: { url, jobId, failure_reason: failureReason },
    });

    throw new Error(`linkedin_guest_validation_failed: ${failureReason}`);
  }

  await recordExternalApiCall({
    userId: opts.userId,
    generationId: opts.generationId,
    provider: 'linkedin_guest',
    operation: 'linkedin_guest_jd_fetch',
    endpoint: targetEndpoint,
    itemsCount: 1,
    latencyMs,
    status: 'success',
    startedAt,
    completedAt,
    metadata: {
      url,
      jobId,
      title: parsedData.title,
      company: parsedData.company,
      raw_text_length: parsedData.rawText.length,
    },
  });

  console.log(`[linkedin_guest] ✓ Successfully extracted job posting for "${parsedData.title}" in ${latencyMs}ms`);

  return parsedData;
}
