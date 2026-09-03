import { requireUser } from '../../../../lib/server/auth.js';
import { recordAndCheckFingerprint } from '../../../../lib/server/services/fingerprint.js';
import { json, options, handleError } from '../../../../lib/server/http.js';
import { rateLimit } from '../../../../lib/server/rateLimit.js';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return options();
}

export async function POST(request) {
  try {
    const userId = requireUser(request);
    const limiter = rateLimit(request, { limit: 30, windowMs: 60000, keyPrefix: `fp_${userId}` });
    if (!limiter.success) {
      return json({ error: 'rate_limited' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const fingerprint = (body.fingerprint || '').trim();
    const clientId = (body.clientId || body.client_id || '').trim();

    if (!fingerprint) {
      return json({ error: 'invalid_fingerprint' }, { status: 400 });
    }

    const result = await recordAndCheckFingerprint({
      userId,
      clientId: clientId || null,
      fingerprint,
    });

    return json({
      success: true,
      flagged: result.flagged,
      fingerprintCount: result.fingerprintCount,
    });
  } catch (error) {
    return handleError(error);
  }
}
