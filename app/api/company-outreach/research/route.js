import { z } from 'zod';
import { requireVerifiedUser } from '../../../../lib/server/auth.js';
import { getCollections } from '../../../../lib/server/db/mongodb.js';
import { discoverCompanyPeople } from '../../../../lib/server/services/companyOutreach.js';
import { searchCompanyNews } from '../../../../lib/server/services/tavily.js';
import { json, options, handleError } from '../../../../lib/server/http.js';
import { rateLimit } from '../../../../lib/server/rateLimit.js';

const schema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  candidateProfile: z.record(z.any()).optional().nullable(),
});

export const runtime = 'nodejs';

export async function OPTIONS() {
  return options();
}

export async function POST(request) {
  try {
    const uid = await requireVerifiedUser(request);

    const limiter = rateLimit(request, { limit: 20, windowMs: 60000, keyPrefix: `cor_${uid}` });
    if (!limiter.success) {
      return json(
        { error: 'rate_limited', message: 'Rate limit exceeded. Please wait a minute before searching again.' },
        { status: 429 }
      );
    }

    const { companyName, candidateProfile } = schema.parse(await request.json());
    const cleanCompanyName = companyName.trim();

    if (!cleanCompanyName) {
      return json({ error: 'invalid_company', message: 'Company name cannot be empty.' }, { status: 400 });
    }

    // Load candidate profile from database if not explicitly supplied
    let profileContext = candidateProfile || null;
    if (!profileContext) {
      const { profiles } = await getCollections();
      const profileDoc = await profiles.findOne({ user_id: uid });
      if (profileDoc) {
        profileContext = {
          current_title: profileDoc.current_title ?? profileDoc.currentTitle ?? '',
          current_ctc: profileDoc.current_ctc ?? profileDoc.currentCtc ?? '',
          expected_ctc: profileDoc.expected_ctc ?? profileDoc.expectedCtc ?? '',
          notice_period: profileDoc.notice_period ?? profileDoc.noticePeriod ?? '',
          location: profileDoc.location ?? '',
          resume: profileDoc.resume_structured ?? null,
        };
      }
    }

    console.log(`[api/company-outreach/research] Researching people & news for: "${cleanCompanyName}"`);

    // Run people discovery via TinyFish and company news search in parallel
    const [peopleDiscoveryResult, companySources] = await Promise.all([
      discoverCompanyPeople({
        company: cleanCompanyName,
        profile: profileContext || {},
        userId: uid,
      }),
      searchCompanyNews({
        company: cleanCompanyName,
        userId: uid,
      }).catch((err) => {
        console.warn(`[api/company-outreach/research] Tavily search error: ${err.message}`);
        return [];
      }),
    ]);

    return json({
      company: cleanCompanyName,
      people: peopleDiscoveryResult.people,
      sources: companySources,
      researchMetadata: {
        searches_count: peopleDiscoveryResult.totalSearches,
        total_found: peopleDiscoveryResult.totalFound,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
