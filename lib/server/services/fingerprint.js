import { getCollections } from '../db/mongodb.js';
import { toObjectId } from '../db/ids.js';

/**
 * Associates a device fingerprint with a user profile and checks whether this
 * fingerprint is shared across multiple user accounts.
 *
 * Soft deterrent: NEVER blocks signups or updates; flags and logs for abuse detection.
 *
 * @param {object} params
 * @param {string|import('mongodb').ObjectId} params.userId
 * @param {string} [params.clientId]
 * @param {string} params.fingerprint
 * @returns {Promise<{ flagged: boolean, fingerprintCount: number, matchingUserIds: string[] }>}
 */
export async function recordAndCheckFingerprint({ userId, clientId = null, fingerprint }) {
  if (!userId || !fingerprint) {
    return { flagged: false, fingerprintCount: 1, matchingUserIds: [] };
  }

  const { users, creditTransactions } = await getCollections();
  const uid = toObjectId(userId);

  // Find all other users sharing this device_fingerprint in MongoDB
  const otherUsers = await users
    .find({
      device_fingerprint: fingerprint,
      _id: { $ne: uid },
    })
    .project({ _id: 1, email: 1 })
    .toArray();

  const matchingUserIds = otherUsers.map((u) => u._id.toString());
  const flagged = matchingUserIds.length > 0;
  const fingerprintCount = matchingUserIds.length + 1;

  // Update user document with device_fingerprint and flagged status
  await users.updateOne(
    { _id: uid },
    {
      $set: {
        device_fingerprint: fingerprint,
        fingerprint_client_id: clientId || null,
        fingerprint_flagged: flagged,
        fingerprint_count: fingerprintCount,
        last_fingerprint_seen_at: new Date(),
        updated_at: new Date(),
      },
    }
  );

  // Log flag event if repeat signup / shared fingerprint detected
  if (flagged) {
    try {
      const db = (await import('../db/mongodb.js')).getDb;
      const database = await db();
      await database.collection('fingerprint_flag_logs').insertOne({
        user_id: uid,
        client_id: clientId || null,
        device_fingerprint: fingerprint,
        event_type: 'signup_flagged',
        matching_user_ids: matchingUserIds,
        details: {
          matching_count: matchingUserIds.length,
          total_accounts: fingerprintCount,
          message: `Device fingerprint shared across ${fingerprintCount} accounts`,
        },
        created_at: new Date(),
      });
    } catch (logErr) {
      console.error('[Fingerprint] Error logging flag event:', logErr.message);
    }
  }

  return {
    flagged,
    fingerprintCount,
    matchingUserIds,
  };
}
