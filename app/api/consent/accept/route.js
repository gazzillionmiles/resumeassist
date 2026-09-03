import { requireUser } from '@/lib/server/auth.js';
import { insertTermsConsentEvent, TERMS_CONSENT_VERSION } from '@/lib/server/consent.js';
import { json, options, handleError } from '@/lib/server/http.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function POST(request) {
  try {
    const userId = requireUser(request);
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const provider = body.provider || 'email';
    const event = await insertTermsConsentEvent({
      userId,
      provider,
      headers: request.headers,
    });

    return json({
      success: true,
      consentVersion: TERMS_CONSENT_VERSION,
      acceptedAt: event.created_at,
      message: 'Terms and Privacy Policy consent recorded successfully.',
    });
  } catch (error) {
    return handleError(error);
  }
}
