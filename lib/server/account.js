import { getCollections } from './db/mongodb.js';
import { toObjectId } from './db/ids.js';
import { deleteUserS3Objects } from './services/s3.js';
import { getConsentEventMetadata } from './consent.js';

export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  PENDING_DELETION: 'pending_deletion',
  PURGED: 'purged',
};

export const GRACE_PERIOD_DAYS = 30;

export async function insertAccountLifecycleLog({
  userId,
  eventType,
  actorId,
  metadata = {},
  headers,
  ipAddress: explicitIp,
  userAgent: explicitUa,
}) {
  const { accountLifecycleLogs } = await getCollections();
  const meta = getConsentEventMetadata(headers);
  const ipAddress = explicitIp || meta.ipAddress;
  const userAgent = explicitUa || meta.userAgent;

  const logDoc = {
    user_id: userId.toString(),
    event_type: eventType,
    actor_id: actorId ? actorId.toString() : userId.toString(),
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata,
    created_at: new Date(),
  };

  await accountLifecycleLogs.insertOne(logDoc);
  return logDoc;
}

export async function requestAccountDeletion({ userId, reason, headers }) {
  const { users } = await getCollections();
  const user = await users.findOne({ _id: toObjectId(userId) });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (user.deletion_status === ACCOUNT_STATUS.PENDING_DELETION) {
    const error = new Error('Account is already pending deletion');
    error.status = 400;
    throw error;
  }

  const meta = getConsentEventMetadata(headers);
  const now = new Date();
  const purgeDate = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await users.updateOne(
    { _id: toObjectId(userId) },
    {
      $set: {
        deletion_status: ACCOUNT_STATUS.PENDING_DELETION,
        deletion_requested_at: now,
        scheduled_purge_at: purgeDate,
        deletion_reason: reason ? reason.substring(0, 500) : null,
        deletion_ip_address: meta.ipAddress,
        updated_at: now,
      },
    }
  );

  await insertAccountLifecycleLog({
    userId,
    eventType: 'deletion_requested',
    actorId: userId,
    headers,
    metadata: {
      reason: reason || null,
      scheduled_purge_at: purgeDate.toISOString(),
    },
  });

  return {
    scheduled_purge_at: purgeDate,
    grace_period_days: GRACE_PERIOD_DAYS,
  };
}

export async function restoreAccount({ userId, headers }) {
  const { users } = await getCollections();
  const user = await users.findOne({ _id: toObjectId(userId) });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (user.deletion_status === ACCOUNT_STATUS.PURGED) {
    const error = new Error('Account has been permanently purged and cannot be restored');
    error.status = 410;
    throw error;
  }

  if (user.deletion_status !== ACCOUNT_STATUS.PENDING_DELETION) {
    return { message: 'Account is already active' };
  }

  // Check if grace period has expired
  const now = new Date();
  if (user.scheduled_purge_at && new Date(user.scheduled_purge_at) <= now) {
    const error = new Error('The 30-day grace period for account restoration has expired');
    error.status = 410;
    throw error;
  }

  const newRestorationCount = (user.restoration_count || 0) + 1;

  await users.updateOne(
    { _id: toObjectId(userId) },
    {
      $set: {
        deletion_status: ACCOUNT_STATUS.ACTIVE,
        restoration_count: newRestorationCount,
        updated_at: now,
      },
      $unset: {
        deletion_requested_at: '',
        scheduled_purge_at: '',
        deletion_reason: '',
        deletion_ip_address: '',
      },
    }
  );

  await insertAccountLifecycleLog({
    userId,
    eventType: 'account_restored',
    actorId: userId,
    headers,
    metadata: {
      restoration_count: newRestorationCount,
    },
  });

  return { message: 'Account successfully restored', deletion_status: ACCOUNT_STATUS.ACTIVE };
}

/**
 * Permanently purges user data for accounts whose scheduled_purge_at <= now.
 * Idempotent and safe. Keeps audit log.
 */
export async function purgeExpiredAccounts() {
  const { users, profiles, playbookExamples, generations } = await getCollections();
  const now = new Date();

  const expiredUsers = await users
    .find({
      deletion_status: ACCOUNT_STATUS.PENDING_DELETION,
      scheduled_purge_at: { $lte: now },
    })
    .toArray();

  const results = {
    found: expiredUsers.length,
    purged: 0,
    errors: [],
  };

  for (const user of expiredUsers) {
    const uidStr = user._id.toString();
    try {
      // 1. Fetch profile to get resume S3 key if any
      const profile = await profiles.findOne({ user_id: uidStr });
      const s3Key = profile?.resume_s3_key || null;

      // 2. Delete S3 objects
      await deleteUserS3Objects({ userId: uidStr, specificKey: s3Key });

      // 3. Delete database records (generations, playbook, profile)
      await generations.deleteMany({ user_id: uidStr });
      await playbookExamples.deleteMany({ user_id: uidStr });
      await profiles.deleteMany({ user_id: uidStr });

      // 4. Record account_purged audit log before updating/anonymizing user record
      await insertAccountLifecycleLog({
        userId: uidStr,
        eventType: 'account_purged',
        actorId: 'system_purge_worker',
        metadata: {
          purged_at: now.toISOString(),
          original_email_domain: user.email ? user.email.split('@')[1] : null,
        },
      });

      // 5. Anonymize and mark user as purged (retaining only ID and compliance status)
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            deletion_status: ACCOUNT_STATUS.PURGED,
            purged_at: now,
            email: `purged_${user._id}@deleted.local`,
            password_hash: '',
            updated_at: now,
          },
          $unset: {
            emailVerificationTokenHash: '',
            emailVerificationExpiresAt: '',
            deletion_reason: '',
            deletion_ip_address: '',
          },
        }
      );

      results.purged++;
    } catch (err) {
      console.error(`[purge] Error purging user ${uidStr}:`, err);
      results.errors.push({ userId: uidStr, error: err.message });
    }
  }

  return results;
}
