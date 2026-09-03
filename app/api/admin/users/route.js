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
    const { users, generations } = await getCollections();

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));

    const filter = { deletion_status: { $ne: 'purged' } };
    if (query) {
      filter.email = { $regex: query, $options: 'i' };
    }

    // Strictly project safe public fields only
    const userDocs = await users
      .find(filter, {
        projection: {
          _id: 1,
          email: 1,
          emailVerified: 1,
          free_credits: 1,
          purchased_credits: 1,
          is_admin: 1,
          deletion_status: 1,
          device_fingerprint: 1,
          fingerprint_flagged: 1,
          fingerprint_count: 1,
          created_at: 1,
          updated_at: 1,
        },
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Attach generation count for each user
    const userIds = userDocs.map((u) => u._id.toString());
    const genCounts = await generations
      .aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { _id: '$user_id', count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = new Map(genCounts.map((g) => [g._id, g.count]));

    const usersList = userDocs.map((u) => {
      const free = Math.max(0, u.free_credits ?? 5);
      const purchased = Math.max(0, u.purchased_credits ?? 0);
      return {
        id: u._id.toString(),
        email: u.email,
        email_verified: Boolean(u.emailVerified),
        free_credits: free,
        purchased_credits: purchased,
        total_credits: free + purchased,
        generations_count: countMap.get(u._id.toString()) || 0,
        is_admin: Boolean(u.is_admin),
        deletion_status: u.deletion_status || 'active',
        fingerprint_flagged: Boolean(u.fingerprint_flagged),
        fingerprint_count: u.fingerprint_count || 1,
        created_at: u.created_at,
      };
    });

    const totalCount = await users.countDocuments(filter);

    return json({
      users: usersList,
      total: totalCount,
      limit,
      skip,
    });
  } catch (error) {
    return handleError(error);
  }
}
