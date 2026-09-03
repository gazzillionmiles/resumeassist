import { requireAdminUser } from '../../../../lib/server/auth.js';
import { getCollections } from '../../../../lib/server/db/mongodb.js';
import { json, options, handleError } from '../../../../lib/server/http.js';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return options();
}

export async function GET(request) {
  try {
    await requireAdminUser(request);
    const { users, creditTransactions, consentEvents } = await getCollections();

    // 1. Users with 0 credits remaining
    const zeroCreditUsers = await users
      .find(
        {
          free_credits: { $lte: 0 },
          purchased_credits: { $lte: 0 },
          deletion_status: { $ne: 'purged' },
        },
        {
          projection: {
            _id: 1,
            email: 1,
            free_credits: 1,
            purchased_credits: 1,
            created_at: 1,
            updated_at: 1,
          },
        }
      )
      .sort({ updated_at: -1 })
      .limit(50)
      .toArray();

    // 2. Recent credit exhaustion transactions
    const exhaustionTransactions = await creditTransactions
      .find({ type: 'generation' })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    // 3. Telemetry/Consent and intent activity events
    const intentEvents = await consentEvents
      .find({ event_type: { $in: ['payment_wall_viewed', 'payment_wall_clicked', 'upgrade_intent'] } })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    return json({
      zero_credit_users: zeroCreditUsers.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        free_credits: u.free_credits ?? 0,
        purchased_credits: u.purchased_credits ?? 0,
        created_at: u.created_at,
        last_active: u.updated_at,
      })),
      total_zero_credit_users: zeroCreditUsers.length,
      recent_exhaustions: exhaustionTransactions.map((t) => ({
        id: t._id.toString(),
        user_id: t.user_id.toString(),
        generation_id: t.generation_id || null,
        created_at: t.created_at,
      })),
      intent_events: intentEvents.map((e) => ({
        id: e._id.toString(),
        user_id: e.user_id,
        event_type: e.event_type,
        created_at: e.created_at,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
