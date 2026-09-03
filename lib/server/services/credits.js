import { getCollections } from '../db/mongodb.js';
import { toObjectId } from '../db/ids.js';
import { config } from '../config.js';

export const FREE_CREDITS = config.credits?.welcomeFreeCredits ?? 5;
export const GENERATION_CREDIT_COST = config.credits?.generationCreditCost ?? 1;

/**
 * Ensures a user account has its initial free credits granted exactly once.
 * Thread-safe and idempotent.
 *
 * @param {string|import('mongodb').ObjectId} userId
 * @returns {Promise<{ freeCredits: number, purchasedCredits: number, totalCredits: number }>}
 */
export async function initializeUserCredits(userId) {
  if (!userId) {
    return { freeCredits: 0, purchasedCredits: 0, totalCredits: 0 };
  }

  const { users, creditTransactions } = await getCollections();
  const uid = toObjectId(userId);

  const user = await users.findOne({ _id: uid });
  if (!user) {
    return { freeCredits: 0, purchasedCredits: 0, totalCredits: 0 };
  }

  // If already granted, return current values
  if (user.free_credits_granted && typeof user.free_credits === 'number') {
    const free = Math.max(0, user.free_credits || 0);
    const purchased = Math.max(0, user.purchased_credits || 0);
    return {
      freeCredits: free,
      purchasedCredits: purchased,
      totalCredits: free + purchased,
    };
  }

  // Atomically initialize free credits if not yet granted
  const updateResult = await users.findOneAndUpdate(
    { _id: uid, free_credits_granted: { $ne: true } },
    {
      $set: {
        free_credits: FREE_CREDITS,
        purchased_credits: user.purchased_credits || 0,
        free_credits_granted: true,
        updated_at: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (updateResult) {
    // Record audit transaction for the initial welcome grant
    await creditTransactions.insertOne({
      user_id: uid,
      type: 'free_grant',
      amount: FREE_CREDITS,
      generation_id: null,
      created_at: new Date(),
      metadata: { source: 'welcome_free_credits' },
    });

    const free = updateResult.free_credits ?? FREE_CREDITS;
    const purchased = updateResult.purchased_credits ?? 0;
    return {
      freeCredits: free,
      purchasedCredits: purchased,
      totalCredits: free + purchased,
    };
  }

  // If another concurrent request initialized it first, reload
  const reloaded = await users.findOne({ _id: uid });
  const free = Math.max(0, reloaded?.free_credits || 0);
  const purchased = Math.max(0, reloaded?.purchased_credits || 0);
  return {
    freeCredits: free,
    purchasedCredits: purchased,
    totalCredits: free + purchased,
  };
}

/**
 * Retrieves the current credit balance for a user.
 * Initializes credits if the user account does not have credits set.
 *
 * @param {string|import('mongodb').ObjectId} userId
 * @returns {Promise<{ freeCredits: number, purchasedCredits: number, totalCredits: number }>}
 */
export async function getUserCredits(userId) {
  if (!userId) {
    return { freeCredits: 0, purchasedCredits: 0, totalCredits: 0 };
  }

  return initializeUserCredits(userId);
}

/**
 * Atomically checks and reserves 1 credit before beginning expensive generation.
 * Safe against concurrent requests (uses atomic findOneAndUpdate).
 * Deducts from free_credits first, then purchased_credits.
 *
 * @param {object} params
 * @param {string|import('mongodb').ObjectId} params.userId
 * @param {string} [params.generationId]
 * @returns {Promise<{ success: boolean, creditSource?: 'free'|'purchased', freeCredits: number, purchasedCredits: number, totalCredits: number, code?: string }>}
 */
export async function reserveGenerationCredit({ userId, generationId = null }) {
  if (!userId) {
    return { success: false, code: 'NO_CREDITS', freeCredits: 0, purchasedCredits: 0, totalCredits: 0 };
  }

  const { users } = await getCollections();
  const uid = toObjectId(userId);

  // Ensure user credits are initialized first
  await initializeUserCredits(uid);

  // 1. Try to atomically decrement from free_credits first
  let updateResult = await users.findOneAndUpdate(
    { _id: uid, free_credits: { $gte: GENERATION_CREDIT_COST } },
    {
      $inc: { free_credits: -GENERATION_CREDIT_COST },
      $set: { updated_at: new Date() },
    },
    { returnDocument: 'after' }
  );

  let creditSource = 'free';

  // 2. If no free credits remaining, try purchased_credits
  if (!updateResult) {
    updateResult = await users.findOneAndUpdate(
      { _id: uid, purchased_credits: { $gte: GENERATION_CREDIT_COST } },
      {
        $inc: { purchased_credits: -GENERATION_CREDIT_COST },
        $set: { updated_at: new Date() },
      },
      { returnDocument: 'after' }
    );
    creditSource = 'purchased';
  }

  // 3. If neither had sufficient balance, return NO_CREDITS
  if (!updateResult) {
    const current = await users.findOne({ _id: uid });
    const free = Math.max(0, current?.free_credits || 0);
    const purchased = Math.max(0, current?.purchased_credits || 0);
    return {
      success: false,
      code: 'NO_CREDITS',
      freeCredits: free,
      purchasedCredits: purchased,
      totalCredits: free + purchased,
    };
  }

  const free = Math.max(0, updateResult.free_credits || 0);
  const purchased = Math.max(0, updateResult.purchased_credits || 0);

  return {
    success: true,
    creditSource,
    freeCredits: free,
    purchasedCredits: purchased,
    totalCredits: free + purchased,
  };
}

/**
 * Confirms consumption of a reserved credit and records an audit transaction.
 *
 * @param {object} params
 * @param {string|import('mongodb').ObjectId} params.userId
 * @param {string} params.generationId
 * @param {object} params.reservation
 * @returns {Promise<void>}
 */
export async function confirmGenerationCredit({ userId, generationId, reservation }) {
  if (!userId || !reservation) return;

  try {
    const { creditTransactions } = await getCollections();
    const uid = toObjectId(userId);
    const genIdStr = generationId ? generationId.toString() : null;

    await creditTransactions.insertOne({
      user_id: uid,
      type: 'generation',
      amount: -GENERATION_CREDIT_COST,
      generation_id: genIdStr,
      created_at: new Date(),
      metadata: {
        credit_source: reservation.creditSource || 'free',
        generation_id: genIdStr,
      },
    });
  } catch (err) {
    console.error('[credits] Error confirming credit consumption:', err.message);
  }
}

/**
 * Atomically refunds a reserved credit if generation fails.
 *
 * @param {object} params
 * @param {string|import('mongodb').ObjectId} params.userId
 * @param {string} [params.generationId]
 * @param {object} params.reservation
 * @param {string} [params.reason]
 * @returns {Promise<{ freeCredits: number, purchasedCredits: number, totalCredits: number }>}
 */
export async function refundGenerationCredit({
  userId,
  generationId = null,
  reservation,
  reason = 'generation_failed',
}) {
  if (!userId || !reservation) {
    return { freeCredits: 0, purchasedCredits: 0, totalCredits: 0 };
  }

  const { users, creditTransactions } = await getCollections();
  const uid = toObjectId(userId);
  const genIdStr = generationId ? generationId.toString() : null;
  const sourceField = reservation.creditSource === 'purchased' ? 'purchased_credits' : 'free_credits';

  const updateResult = await users.findOneAndUpdate(
    { _id: uid },
    {
      $inc: { [sourceField]: GENERATION_CREDIT_COST },
      $set: { updated_at: new Date() },
    },
    { returnDocument: 'after' }
  );

  try {
    await creditTransactions.insertOne({
      user_id: uid,
      type: 'refund',
      amount: GENERATION_CREDIT_COST,
      generation_id: genIdStr,
      created_at: new Date(),
      metadata: {
        credit_source: reservation.creditSource || 'free',
        reason,
        generation_id: genIdStr,
      },
    });
  } catch (err) {
    console.error('[credits] Error recording refund transaction:', err.message);
  }

  const free = Math.max(0, updateResult?.free_credits || 0);
  const purchased = Math.max(0, updateResult?.purchased_credits || 0);

  return {
    freeCredits: free,
    purchasedCredits: purchased,
    totalCredits: free + purchased,
  };
}
