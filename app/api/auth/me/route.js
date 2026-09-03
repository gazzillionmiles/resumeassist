import { getCollections } from '../../../../lib/server/db/mongodb.js';
import { requireUser } from '../../../../lib/server/auth.js';
import { toObjectId } from '../../../../lib/server/db/ids.js';
import { TERMS_CONSENT_VERSION } from '../../../../lib/server/consent.js';
import { getUserCredits } from '../../../../lib/server/services/credits.js';
import { isProfileComplete } from '../../../../lib/server/profile.js';
import { json, options, handleError } from '../../../../lib/server/http.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    const userId = requireUser(request);
    const { users, profiles } = await getCollections();
    const user = await users.findOne({ _id: toObjectId(userId) });
    if (!user) {
      const error = new Error('user_not_found');
      error.status = 401;
      throw error;
    }

    if (user.deletion_status === 'purged') {
      const error = new Error('account_purged');
      error.status = 401;
      throw error;
    }

    const [credits, profile] = await Promise.all([
      getUserCredits(userId),
      profiles.findOne({ user_id: userId }),
    ]);

    const profileComplete = isProfileComplete(profile);

    return json({
      user: {
        id: user._id.toString(),
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
        deletion_status: user.deletion_status || 'active',
        deletion_requested_at: user.deletion_requested_at || null,
        scheduled_purge_at: user.scheduled_purge_at || null,
        has_terms_consent: Boolean(user.has_terms_consent && user.terms_consent_version === TERMS_CONSENT_VERSION),
        terms_consent_version: user.terms_consent_version || null,
        is_admin: Boolean(user.is_admin),
        is_profile_complete: profileComplete,
        credits: {
          free: credits.freeCredits,
          purchased: credits.purchasedCredits,
          total: credits.totalCredits,
        },
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
