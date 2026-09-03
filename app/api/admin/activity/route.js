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
    const { generationCostLogs, users, generations } = await getCollections();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0', 10));
    const statusFilter = searchParams.get('status');

    const filter = {};
    if (statusFilter && ['completed', 'failed'].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    const activityDocs = await generationCostLogs
      .find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Look up corresponding user emails and generation types
    const userIds = Array.from(new Set(activityDocs.map((a) => a.user_id).filter(Boolean)));
    const genIds = activityDocs.map((a) => a.generation_id).filter(Boolean);

    const [userDocs, genDocs] = await Promise.all([
      users.find({ _id: { $in: userIds.map(toObjectId) } }, { projection: { _id: 1, email: 1 } }).toArray(),
      generations.find({ _id: { $in: genIds.map(toObjectId) } }, { projection: { _id: 1, generation_type: 1, company_name: 1, role_title: 1 } }).toArray(),
    ]);

    const userMap = new Map(userDocs.map((u) => [u._id.toString(), u.email]));
    const genMap = new Map(genDocs.map((g) => [g._id.toString(), g]));

    const activities = activityDocs.map((item) => {
      const gen = genMap.get(item.generation_id);
      return {
        id: item._id.toString(),
        generation_id: item.generation_id,
        user_id: item.user_id,
        user_email: userMap.get(item.user_id) || 'unknown@user',
        generation_type: gen?.generation_type || (gen?.company_name ? 'company_outreach' : 'job_outreach'),
        company_name: gen?.company_name || 'Target Company',
        role_title: gen?.role_title || '',
        status: item.status || 'completed',
        error_message: item.error_message || null,
        total_latency_ms: item.total_latency_ms || 0,
        total_cost_usd: item.costs?.total_generation_cost_usd || 0,
        cost_breakdown: {
          llm_usd: item.costs?.llm?.cost_usd || 0,
          tavily_usd: item.costs?.tavily?.cost_usd || 0,
          tinyfish_usd: item.costs?.tinyfish?.cost_usd || 0,
        },
        created_at: item.created_at,
      };
    });

    const total = await generationCostLogs.countDocuments(filter);

    return json({
      activities,
      total,
      limit,
      skip,
    });
  } catch (error) {
    return handleError(error);
  }
}
