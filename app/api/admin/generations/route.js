import { requireAdminUser } from '../../../../lib/server/auth.js';
import { getCollections } from '../../../../lib/server/db/mongodb.js';
import { toObjectId } from '../../../../lib/server/db/ids.js';
import { json, options, handleError } from '../../../../lib/server/http.js';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return options();
}

export async function GET(request) {
  try {
    await requireAdminUser(request);
    const { generations, users } = await getCollections();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));
    const userId = searchParams.get('userId');
    const generationType = searchParams.get('type');

    const filter = {};
    if (userId) filter.user_id = userId;
    if (generationType) filter.generation_type = generationType;

    const generationDocs = await generations
      .find(filter, {
        projection: {
          _id: 1,
          user_id: 1,
          generation_type: 1,
          company_name: 1,
          role_title: 1,
          tone: 1,
          fetch_status: 1,
          email_subject: 1,
          was_copied_or_shared: 1,
          created_at: 1,
          accounting: 1,
        },
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Map user emails
    const userIds = Array.from(new Set(generationDocs.map((g) => g.user_id).filter(Boolean)));
    const userDocs = await users
      .find({ _id: { $in: userIds.map(toObjectId) } }, { projection: { _id: 1, email: 1 } })
      .toArray();

    const userMap = new Map(userDocs.map((u) => [u._id.toString(), u.email]));

    const list = generationDocs.map((g) => ({
      id: g._id.toString(),
      user_id: g.user_id,
      user_email: userMap.get(g.user_id) || 'Unknown User',
      generation_type: g.generation_type || (g.company_name ? 'company_outreach' : 'job_outreach'),
      company_name: g.company_name || 'Target Company',
      role_title: g.role_title || '',
      tone: g.tone || 'warm_professional',
      fetch_status: g.fetch_status || 'ok',
      email_subject: g.email_subject || '',
      was_sent: Boolean(g.was_copied_or_shared),
      cost_usd: g.accounting?.total_generation_cost_usd || 0,
      latency_seconds: g.accounting?.total_latency_ms ? Math.round(g.accounting.total_latency_ms / 100) / 10 : 0,
      created_at: g.created_at,
    }));

    const total = await generations.countDocuments(filter);

    return json({
      generations: list,
      total,
      limit,
      skip,
    });
  } catch (error) {
    return handleError(error);
  }
}
