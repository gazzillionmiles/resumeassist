import { requireUser } from '@/lib/server/auth.js';
import { requestAccountDeletion } from '@/lib/server/account.js';
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
      // Body required
    }

    if (body.confirmation_text !== 'DELETE') {
      return json(
        { error: 'invalid_confirmation', message: 'Please type DELETE to confirm account deletion.' },
        { status: 400 }
      );
    }

    const result = await requestAccountDeletion({
      userId,
      reason: body.reason,
      headers: request.headers,
    });

    return json({
      success: true,
      message: 'Account scheduled for deletion in 30 days.',
      scheduled_purge_at: result.scheduled_purge_at,
      grace_period_days: result.grace_period_days,
    });
  } catch (error) {
    return handleError(error);
  }
}
