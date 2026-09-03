import { z } from 'zod';
import { getCollections } from '../../../lib/server/db/mongodb.js';
import { requireVerifiedUser } from '../../../lib/server/auth.js';
import { isProfileComplete, getMissingProfileFields } from '../../../lib/server/profile.js';
import { json, options, noContent, handleError } from '../../../lib/server/http.js';

const schema = z.object({
  current_ctc: z.string().optional(),
  expected_ctc: z.string().optional(),
  notice_period: z.string().optional(),
  current_title: z.string().optional(),
  location: z.string().optional(),
  currentCtc: z.string().optional(),
  expectedCtc: z.string().optional(),
  noticePeriod: z.string().optional(),
  currentTitle: z.string().optional(),
});

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    const uid = await requireVerifiedUser(request);
    const { profiles } = await getCollections();
    const profile = await profiles.findOne({ user_id: uid });
    if (!profile) return json(null);

    const isComplete = isProfileComplete(profile);
    const missingFields = getMissingProfileFields(profile);

    return json({
      id: profile._id.toString(),
      current_title: profile.current_title ?? profile.currentTitle ?? '',
      current_ctc: profile.current_ctc ?? profile.currentCtc ?? '',
      expected_ctc: profile.expected_ctc ?? profile.expectedCtc ?? '',
      notice_period: profile.notice_period ?? profile.noticePeriod ?? '',
      location: profile.location ?? '',
      resume_structured: profile.resume_structured ?? null,
      resume_parse_confidence: profile.resume_parse_confidence ?? null,
      resume_filename: profile.resume_filename ?? null,
      is_complete: isComplete,
      missing_fields: missingFields,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
  } catch (e) { return handleError(e); }
}

export async function POST(request) {
  try {
    const uid = await requireVerifiedUser(request);
    const f = schema.parse(await request.json());
    const { profiles } = await getCollections();

    const doc = {
      current_title: f.current_title ?? f.currentTitle ?? '',
      current_ctc: f.current_ctc ?? f.currentCtc ?? '',
      expected_ctc: f.expected_ctc ?? f.expectedCtc ?? '',
      notice_period: f.notice_period ?? f.noticePeriod ?? '',
      location: f.location ?? '',
      user_id: uid,
      updated_at: new Date(),
    };

    await profiles.updateOne(
      { user_id: uid },
      {
        $set: doc,
        $unset: { work_auth: '', workAuth: '', work_authorization: '', workAuthorization: '' },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );
    return noContent();
  } catch (e) { return handleError(e); }
}
