import { searchTinyFish, fetchCompanySources } from './tinyfish.js';
import { searchCompanyNews } from './tavily.js';
import { callBedrockJSON } from './bedrock.js';
import {
  COMPANY_OUTREACH_RESEARCH_SYSTEM_PROMPT,
  buildCompanyOutreachResearchPrompt,
} from '../prompts/companyResearch.js';
import {
  COMPANY_OUTREACH_MESSAGE_SYSTEM_PROMPT,
  buildCompanyOutreachMessagePrompt,
} from '../prompts/messageGenerate.js';

/**
 * Priority tiers for Talent Acquisition & Recruiting roles.
 */
const RELEVANCE_PRIORITY = [
  { pattern: /\b(technical recruiter|tech recruiter|engineering recruiter|infra(?:structure)? recruiter|data recruiter|ai recruiter|software recruiter)\b/i, score: 100, label: 'Technical Recruiter', category: 'technical_recruiter' },
  { pattern: /\b(talent acquisition partner|senior talent partner|lead talent partner|principal talent partner|talent partner)\b/i, score: 95, label: 'Talent Acquisition Partner', category: 'talent_partner' },
  { pattern: /\b(head of talent( acquisition)?|director of talent( acquisition)?|vp of talent( acquisition)?|vp of recruiting|director of recruiting|head of recruiting|talent acquisition manager|recruiting manager|lead recruiter|recruiting lead)\b/i, score: 90, label: 'Talent Leadership', category: 'talent_leadership' },
  { pattern: /\b(talent acquisition specialist|talent acquisition lead|talent acquisition|corporate recruiter|senior recruiter|recruiter|recruiting specialist)\b/i, score: 85, label: 'Talent Acquisition', category: 'recruiter' },
  { pattern: /\b(head of people|director of people|vp of people|people partner|chief people officer)\b/i, score: 75, label: 'People Leadership', category: 'people_leadership' },
  { pattern: /\b(talent sourcer|technical sourcer|talent sourcing specialist|sourcing recruiter)\b/i, score: 70, label: 'Talent Sourcer', category: 'talent_sourcer' },
];

/**
 * Negative patterns to filter out non-recruiting employees, job search boards, generic HR, or external staffing agencies.
 */
const IRRELEVANT_PATTERNS = [
  /\b(software engineer|developer|account executive|sales rep|marketing manager|intern|student|alumni|customer service|cashier|graphic designer|account manager|product manager|data scientist|attorney|legal counsel)\b/i,
  /\b(jobs|careers|openings|vacancies|top \d+|\d+\+? profiles|\d+\+? jobs|list of|salary|reviews|hiring now|directory|search candidates|find people|why i left)\b/i,
  /\b(freelance recruiter|recruiting consultant|independent recruiter|staffing consultant|hr consultant|recruitment consultant at self-employed|career coach|resume writer|fractional hr)\b/i,
  /\b(payroll|benefits specialist|compensation analyst|labor relations|hr assistant|hr admin|office manager)\b/i,
];

/**
 * Checks if a URL is a valid personal LinkedIn profile URL (e.g. /in/username).
 * Rejects job posts, company pages, articles/pulse, feeds, and directories.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isLinkedInPersonalProfileUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return false;

    const path = parsed.pathname.toLowerCase();
    if (!path.startsWith('/in/')) return false;

    const slug = path.replace(/^\/in\//, '').replace(/\/.*$/, '').trim();
    if (!slug || ['dir', 'overview', 'search', 'jobs', 'company', 'posts', 'pulse', 'feed', 'learning', 'events'].includes(slug)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates variations of a company name (e.g., stripping legal suffixes like Inc, LLC, Ltd, etc.).
 *
 * @param {string} company
 * @returns {string[]}
 */
export function getCompanyVariations(company) {
  if (!company || typeof company !== 'string') return [];
  const clean = company.trim();
  const stripped = clean
    .replace(/[,.]?\s*(?:inc|llc|ltd|technologies|technology|tech|labs|corp|corporation|co|group|holdings|services)\.?$/i, '')
    .trim();
  return Array.from(new Set([clean, stripped].filter((s) => s && s.length >= 2)));
}

/**
 * Cleans and canonicalizes a LinkedIn profile URL by stripping query parameters and tracking hashes.
 * @param {string} url
 * @returns {string}
 */
export function canonicalizeProfileUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    // Retain only hostname and pathname
    return `${parsed.protocol}//${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return url.trim();
  }
}

/**
 * Verifies whether a candidate is currently employed at the target company and has a recruiting/hiring role.
 *
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.snippet
 * @param {string} params.rawUrl
 * @param {string} params.company
 * @returns {{ isVerified: boolean, matchedTitle: string, matchedCompany: string, reason: string, score: number, roleCategory: string, location?: string }}
 */
export function verifyCurrentEmployment({ title, snippet, rawUrl, company }) {
  const variations = getCompanyVariations(company);
  if (variations.length === 0) {
    return { isVerified: false, matchedTitle: '', matchedCompany: '', reason: 'Missing company name', score: 0, roleCategory: 'unknown' };
  }

  const rawTitle = (title || '').trim();
  const rawSnippet = (snippet || '').trim();
  const combinedText = `${rawTitle} ${rawSnippet}`;

  // 1. Build regex pattern matching any company variation with word boundaries
  const escapedVariations = variations.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const companyPattern = new RegExp(`\\b(?:${escapedVariations.join('|')})\\b`, 'i');

  // Check if company is mentioned anywhere in title or snippet
  if (!companyPattern.test(combinedText)) {
    return {
      isVerified: false,
      matchedTitle: '',
      matchedCompany: '',
      reason: `No mention of ${company} found in profile headline or snippet`,
      score: 0,
      roleCategory: 'unknown',
    };
  }

  // 2. Identify Role & Relevance
  let matchedPrio = null;
  for (const prio of RELEVANCE_PRIORITY) {
    if (prio.pattern.test(rawTitle) || prio.pattern.test(rawSnippet)) {
      matchedPrio = prio;
      break;
    }
  }

  if (!matchedPrio) {
    return {
      isVerified: false,
      matchedTitle: '',
      matchedCompany: '',
      reason: `No verified recruiting or talent acquisition role found for ${company}`,
      score: 0,
      roleCategory: 'unknown',
    };
  }

  // Check for irrelevant role / consultant / non-recruiting employee patterns in title
  for (const irr of IRRELEVANT_PATTERNS) {
    if (irr.test(rawTitle) && !RELEVANCE_PRIORITY.some((p) => p.pattern.test(rawTitle))) {
      return {
        isVerified: false,
        matchedTitle: '',
        matchedCompany: '',
        reason: `Title contains non-recruiting or aggregator terms`,
        score: 0,
        roleCategory: 'irrelevant',
      };
    }
  }

  // 3. Negative Evidence: Check for Former / Ex / Past Employee indicators
  const formerPatterns = [
    new RegExp(`\\b(?:ex[- ]|former(?:ly)?|previous(?:ly)?|past)\\b[^·|\n]*\\b(?:${escapedVariations.join('|')})\\b`, 'i'),
    new RegExp(`\\b(?:worked at|employed at|tenure at|departed|left)\\s+(?:${escapedVariations.join('|')})\\b`, 'i'),
  ];
  if (formerPatterns.some((p) => p.test(combinedText))) {
    return {
      isVerified: false,
      matchedTitle: matchedPrio.label,
      matchedCompany: company,
      reason: `Identified as former/past employee at ${company}`,
      score: 0,
      roleCategory: matchedPrio.category,
    };
  }

  // Check snippet for "Current: ... Past: [Company]"
  const snippetCurrentMatch = rawSnippet.match(/Current:\s*([^·\n]+)/i);
  const snippetPastMatch = rawSnippet.match(/Past:\s*([^·\n]+)/i);

  if (snippetCurrentMatch) {
    const currentText = snippetCurrentMatch[1];
    const isCurrentAtTarget = companyPattern.test(currentText);
    if (!isCurrentAtTarget) {
      return {
        isVerified: false,
        matchedTitle: matchedPrio.label,
        matchedCompany: company,
        reason: `Currently employed elsewhere (${currentText.trim()}), not at ${company}`,
        score: 0,
        roleCategory: matchedPrio.category,
      };
    }
  }

  // Check title segments: if title explicitly states "[Name] - [Role] at [OtherCompany]"
  const titleAtMatch = rawTitle.match(/\b(?:at|@)\s+([A-Z0-9a-z\s&.]+?)(?:\s*[-|–—·]|\s*\||$)/i);
  if (titleAtMatch) {
    const atCompany = titleAtMatch[1].trim();
    if (atCompany && !companyPattern.test(atCompany) && !/linkedin/i.test(atCompany)) {
      // If title says at AnotherCompany and not target company, reject
      return {
        isVerified: false,
        matchedTitle: matchedPrio.label,
        matchedCompany: company,
        reason: `Headline indicates current employment at "${atCompany}" instead of ${company}`,
        score: 0,
        roleCategory: matchedPrio.category,
      };
    }
  }

  // 4. Positive Evidence: Verify Current Employment at Target Company
  let hasPositiveEvidence = false;
  let evidenceDetail = '';

  // Positive signal A: Title explicitly binds role and company
  // e.g. "Jane Doe - Senior Technical Recruiter - Stripe | LinkedIn"
  const segments = rawTitle
    .split(/\s*[-|–—·]\s*/)
    .map((s) => s.replace(/\s*\|\s*LinkedIn$/i, '').trim())
    .filter(Boolean);

  if (segments.some((seg) => companyPattern.test(seg)) && segments.some((seg) => matchedPrio.pattern.test(seg))) {
    hasPositiveEvidence = true;
    evidenceDetail = 'Headline confirms role and target company alignment';
  } else if (new RegExp(`(?:${matchedPrio.pattern.source})\\s+(?:at|@|,|for)\\s+(?:${escapedVariations.join('|')})`, 'i').test(combinedText)) {
    hasPositiveEvidence = true;
    evidenceDetail = `Direct association: ${matchedPrio.label} at ${company}`;
  } else if (snippetCurrentMatch && companyPattern.test(snippetCurrentMatch[1])) {
    hasPositiveEvidence = true;
    evidenceDetail = `Snippet confirms current position at ${company}`;
  } else if (new RegExp(`(?:${escapedVariations.join('|')})\\s*·\\s*(?:${matchedPrio.pattern.source})`, 'i').test(rawSnippet)) {
    hasPositiveEvidence = true;
    evidenceDetail = `Snippet confirms ${matchedPrio.label} role at ${company}`;
  } else if (companyPattern.test(rawTitle) && matchedPrio.pattern.test(rawTitle)) {
    hasPositiveEvidence = true;
    evidenceDetail = `Headline confirms ${matchedPrio.label} with ${company}`;
  }

  if (!hasPositiveEvidence) {
    return {
      isVerified: false,
      matchedTitle: matchedPrio.label,
      matchedCompany: company,
      reason: `Could not verify current employment at ${company}`,
      score: 0,
      roleCategory: matchedPrio.category,
    };
  }

  // Extract location if present in snippet
  let location = '';
  const locationMatch = rawSnippet.match(/\b([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}|San Francisco(?:\s+Bay\s+Area)?|New York(?:\s+City)?|London|Bengaluru|Bangalore|Remote|Seattle|Austin|Berlin|Boston|Chicago|Toronto)\b/i);
  if (locationMatch) {
    location = locationMatch[0].trim();
  }

  return {
    isVerified: true,
    matchedTitle: matchedPrio.label,
    matchedCompany: company,
    reason: `Verified current ${matchedPrio.label} at ${company} (${evidenceDetail})`,
    score: matchedPrio.score,
    roleCategory: matchedPrio.category,
    location: location || undefined,
  };
}

/**
 * Normalizes a single search result into a candidate person object, strictly validating current employment and recruiting relevance.
 *
 * @param {{ title: string, url: string, snippet: string, site_name?: string }} item
 * @param {string} company
 * @returns {{ name: string, title: string, company: string, profile_url: string, source_url: string, relevance_reason: string, score: number, location?: string, current_employee_verified: boolean, recruiting_relevance: string, verification_reason: string, source: string, confidence: number } | null}
 */
export function normalizePerson(item, company) {
  if (!item || !item.title) return null;

  const rawTitle = item.title.trim();
  const rawSnippet = (item.snippet || '').trim();
  const rawUrl = item.url || '';

  // 1. URL Validation: Must be a personal LinkedIn profile URL (/in/...)
  if (rawUrl && !isLinkedInPersonalProfileUrl(rawUrl)) {
    return null;
  }

  // 2. Extract Name from Title separators
  const segments = rawTitle
    .split(/\s*[-|–—·]\s*/)
    .map((s) => s.replace(/\s*\|\s*LinkedIn$/i, '').trim())
    .filter(Boolean);

  if (segments.length === 0) return null;

  let name = segments[0]
    .replace(/^Profile:\s*/i, '')
    .replace(/^\(\d+\+?\)\s*/, '')
    .replace(/\s*,\s*(?:CPRW|PHR|SPHR|SHRM-CP|SHRM-SCP|MBA|CIR|CDR|RACR|CPC)\b.*$/i, '')
    .replace(/\s*\((?:She\/Her|He\/Him|They\/Them|She\/They|He\/They)\)$/i, '')
    .trim();

  // Discard if name looks like a company page, aggregator, directory, or placeholder
  if (!name || name.length < 2 || /^(top \d+|jobs at|careers|working at|linkedin|search|find|view|recruiter|recruiting|unknown|member|people)/i.test(name)) {
    return null;
  }

  // Discard if name contains company legal suffix keywords
  if (/\b(inc|llc|ltd|technologies|solutions|services|group|corp|corporation)\b/i.test(name)) {
    return null;
  }

  // 3. Verify Current Employment & Recruiting Relevance
  const verification = verifyCurrentEmployment({
    title: rawTitle,
    snippet: rawSnippet,
    rawUrl,
    company,
  });

  if (!verification.isVerified || verification.score < 65) {
    return null;
  }

  // 4. Resolve Title (Prefer segment title if it contains the role, or matched priority label)
  let displayTitle = segments.length > 1 && RELEVANCE_PRIORITY.some((p) => p.pattern.test(segments[1]))
    ? segments[1]
    : verification.matchedTitle || 'Talent Acquisition';

  // 5. Build relevance reason tailored to role archetype
  let relevanceReason = `Recruiter at ${company}`;
  if (verification.roleCategory === 'technical_recruiter') {
    relevanceReason = `Technical recruiter specializing in engineering and technical hiring at ${company}`;
  } else if (verification.roleCategory === 'talent_partner') {
    relevanceReason = `Talent acquisition partner focused on talent strategy and hiring at ${company}`;
  } else if (verification.roleCategory === 'talent_leadership') {
    relevanceReason = `Talent acquisition leadership directing recruiting teams at ${company}`;
  } else if (verification.roleCategory === 'people_leadership') {
    relevanceReason = `People and talent leadership professional at ${company}`;
  } else if (verification.roleCategory === 'talent_sourcer') {
    relevanceReason = `Talent sourcer focused on candidate pipeline and outreach at ${company}`;
  } else {
    relevanceReason = `Talent and recruiting team member at ${company}`;
  }

  const cleanProfileUrl = canonicalizeProfileUrl(rawUrl);

  return {
    name,
    title: displayTitle,
    company: verification.matchedCompany || company,
    profile_url: cleanProfileUrl,
    source_url: rawUrl,
    relevance_reason: relevanceReason,
    score: verification.score,
    location: verification.location || undefined,
    current_employee_verified: true,
    recruiting_relevance: verification.roleCategory,
    verification_reason: verification.reason,
    source: 'tinyfish',
    confidence: verification.score >= 85 ? 0.95 : 0.85,
  };
}

/**
 * Deduplicates people by profile URL first, then normalized (name + company).
 *
 * @param {Array<object>} people
 * @returns {Array<object>}
 */
export function deduplicatePeople(people) {
  if (!Array.isArray(people)) return [];

  const seenUrls = new Set();
  const seenNameKeys = new Set();
  const unique = [];

  for (const person of people) {
    if (!person || !person.name) continue;

    const urlKey = person.profile_url ? canonicalizeProfileUrl(person.profile_url).toLowerCase() : null;
    const normName = person.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCompany = (person.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nameKey = `${normName}::${normCompany}`;

    if (urlKey && seenUrls.has(urlKey)) {
      continue;
    }
    if (seenNameKeys.has(nameKey)) {
      continue;
    }

    if (urlKey) seenUrls.add(urlKey);
    seenNameKeys.add(nameKey);
    unique.push(person);
  }

  return unique;
}

/**
 * Filters and sorts discovered people by relevance score.
 * Retains strictly verified current employees with recruiting relevance.
 *
 * @param {Array<object>} people
 * @param {number} [minScore=65]
 * @returns {Array<object>}
 */
export function filterRelevantPeople(people, minScore = 65) {
  if (!Array.isArray(people)) return [];
  return people
    .filter((p) => p && p.current_employee_verified === true && typeof p.score === 'number' && p.score >= minScore)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Discovers Talent Acquisition and Recruiting professionals for a given company via TinyFish Search.
 * Strictly verifies current employment and recruiting role relevance.
 *
 * @param {object} params
 * @param {string} params.company - Target company name
 * @param {object} [params.profile] - Candidate profile context for relevance tuning
 * @param {string} [params.userId] - User ID for usage attribution
 * @param {string} [params.generationId] - Generation ID for usage attribution
 * @param {any} [params.client] - Injected client for testing
 * @returns {Promise<{ people: Array<object>, totalSearches: number, totalFound: number }>}
 */
export async function discoverCompanyPeople({
  company,
  profile = {},
  userId = null,
  generationId = null,
  client = null,
}) {
  if (!company || typeof company !== 'string' || !company.trim()) {
    return { people: [], totalSearches: 0, totalFound: 0 };
  }

  const cleanCompany = company.trim();
  console.log(`[companyOutreach] Starting verified people discovery for company: "${cleanCompany}"`);

  // Define targeted search queries to uncover current recruiting / TA people using site:linkedin.com/in/
  const searchQueries = [
    `"${cleanCompany}" "Talent Acquisition" site:linkedin.com/in/`,
    `"${cleanCompany}" "Technical Recruiter" site:linkedin.com/in/`,
    `"${cleanCompany}" "Talent Acquisition Partner" site:linkedin.com/in/`,
    `"${cleanCompany}" recruiter site:linkedin.com/in/`,
    `"${cleanCompany}" "Head of Talent" site:linkedin.com/in/`,
    `"${cleanCompany}" "Talent Partner" site:linkedin.com/in/`,
    `"${cleanCompany}" "Recruiting Manager" site:linkedin.com/in/`,
    `"${cleanCompany}" "Director of Talent" site:linkedin.com/in/`,
    `"${cleanCompany}" "VP of Talent Acquisition" site:linkedin.com/in/`,
    `"${cleanCompany}" "Recruiting" site:linkedin.com/in/`,
  ];

  const searchPromises = searchQueries.map((query) =>
    searchTinyFish(query, {
      purpose: `Find verified current talent acquisition, technical recruiters, and talent partners currently working at ${cleanCompany}`,
      userId,
      generationId,
      client,
      includeDomains: 'linkedin.com',
    })
  );

  const searchResultsArrays = await Promise.all(searchPromises);
  const rawResults = searchResultsArrays.flat();

  console.log(`[companyOutreach] TinyFish search returned ${rawResults.length} total raw results across ${searchQueries.length} queries`);

  // Step 1: Normalize and verify current employment for each result
  const normalizedPeople = rawResults
    .map((item) => normalizePerson(item, cleanCompany))
    .filter(Boolean);

  // Step 2: Deduplicate across search queries
  const deduplicated = deduplicatePeople(normalizedPeople);

  // Step 3: Prioritize and filter strictly verified candidates
  const prioritized = filterRelevantPeople(deduplicated, 65);

  console.log(`[companyOutreach] Discovered ${prioritized.length} verified current recruiting contacts after normalization, dedup, and filtering`);

  return {
    people: prioritized,
    totalSearches: searchQueries.length,
    totalFound: prioritized.length,
  };
}

/**
 * Conducts deep company research (Tavily search + TinyFish full text + Bedrock analysis) tailored for company outreach (no JD).
 *
 * @param {object} params
 * @param {string} params.company - Target company name
 * @param {object} [params.profile] - Candidate profile
 * @param {string} [params.userId] - User ID
 * @param {string} [params.generationId] - Generation ID
 * @returns {Promise<object>} Structured company research object
 */
export async function conductCompanyOutreachResearch({
  company,
  profile = {},
  userId = null,
  generationId = null,
}) {
  if (!company || typeof company !== 'string' || !company.trim()) {
    throw new Error('Company name is required for company research');
  }

  const cleanCompany = company.trim();
  console.log(`[companyOutreach] Conducting deep company research for "${cleanCompany}" (No JD context)...`);

  // 1. Tavily Search for company news & developments
  let sources = [];
  try {
    sources = await searchCompanyNews({
      company: cleanCompany,
      userId,
      generationId,
    });
  } catch (tavilyErr) {
    console.warn(`[companyOutreach] Tavily search error: ${tavilyErr.message}`);
  }

  // 2. Fetch full text for top sources via TinyFish
  let fetchedArticles = [];
  const urlsToFetch = (sources || []).slice(0, 4).map((s) => s.url).filter(Boolean);

  if (urlsToFetch.length > 0) {
    try {
      const fetched = await fetchCompanySources(urlsToFetch, { userId, generationId });
      fetchedArticles = urlsToFetch.map((url) => {
        const matchFetched = fetched.find((f) => f.url === url);
        const matchSource = sources.find((s) => s.url === url);
        return {
          url,
          title: matchFetched?.title || matchSource?.title || 'Article',
          text: matchFetched?.text || matchSource?.content || '',
        };
      });
    } catch (tinyfishErr) {
      console.warn(`[companyOutreach] TinyFish full text fetch warning: ${tinyfishErr.message}. Using snippets.`);
      fetchedArticles = sources.slice(0, 4).map((s) => ({
        url: s.url,
        title: s.title || 'Article',
        text: s.content || '',
      }));
    }
  }

  // 3. Bedrock Synthesis tailored for Company Outreach
  const rawResearch = await callBedrockJSON(
    COMPANY_OUTREACH_RESEARCH_SYSTEM_PROMPT,
    buildCompanyOutreachResearchPrompt({
      company: cleanCompany,
      profile,
      articles: fetchedArticles,
    }),
    { userId, generationId, action: 'company_outreach_research' }
  );

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

  return {
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
}

/**
 * Generates personalized email and LinkedIn message for Company Outreach based on target person and company intel.
 *
 * @param {object} params
 * @param {string} params.company
 * @param {object} params.selectedPerson - Target person (name, title, relevance_reason, profile_url)
 * @param {object} params.profile - Candidate profile context
 * @param {Array<string>} [params.playbookExamples] - Optional past style examples
 * @param {string} [params.tone] - Outreach tone
 * @param {object} [params.companyResearch] - Synthesized company intel
 * @param {string} [params.userId]
 * @param {string} [params.generationId]
 * @returns {Promise<{ email_subject: string, email_body: string, linkedin_message: string }>}
 */
export async function generateCompanyOutreachMessages({
  company,
  selectedPerson,
  profile,
  playbookExamples = [],
  tone = 'warm_professional',
  companyResearch = null,
  userId = null,
  generationId = null,
}) {
  const output = await callBedrockJSON(
    COMPANY_OUTREACH_MESSAGE_SYSTEM_PROMPT,
    buildCompanyOutreachMessagePrompt({
      company,
      targetPerson: selectedPerson,
      profile,
      playbookExamples,
      tone,
      companyResearch,
    }),
    { userId, generationId, action: 'company_outreach_message_generate' }
  );

  return {
    email_subject: output.email_subject || `${company} / Connecting with ${profile?.resume?.name || 'Engineering Talent'}`,
    email_body: output.email_body || '',
    linkedin_message: output.linkedin_message || '',
  };
}
