import { requireUser } from '@/lib/server/auth.js';
import { hasUserAcceptedTerms, findLatestTermsConsentEvent, TERMS_CONSENT_VERSION } from '@/lib/server/consent.js';
import { json, options, handleError } from '@/lib/server/http.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    const userId = requireUser(request);
    const hasConsent = await hasUserAcceptedTerms(userId);
    const latestEvent = await findLatestTermsConsentEvent(userId);

    return json({
      hasConsent,
      requiredVersion: TERMS_CONSENT_VERSION,
      latestVersion: latestEvent?.consent_version || null,
      acceptedAt: latestEvent?.created_at || null,
    });
  } catch (error) {
    return handleError(error);
  }
}
