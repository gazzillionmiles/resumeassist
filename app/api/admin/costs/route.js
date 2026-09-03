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
    const { generationCostLogs, users } = await getCollections();

    // 1. Overall cost summary aggregation
    const overallAgg = await generationCostLogs
      .aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalCostUsd: { $sum: '$costs.total_generation_cost_usd' },
            totalLlmCostUsd: { $sum: '$costs.llm.cost_usd' },
            totalTavilyCostUsd: { $sum: '$costs.tavily.cost_usd' },
            totalTinyfishCostUsd: { $sum: '$costs.tinyfish.cost_usd' },
            totalGenerations: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // 2. Per-user cost aggregation using MongoDB $group
    const perUserAgg = await generationCostLogs
      .aggregate([
        { $match: { status: 'completed', user_id: { $ne: null } } },
        {
          $group: {
            _id: '$user_id',
            totalGenerations: { $sum: 1 },
            totalCostUsd: { $sum: '$costs.total_generation_cost_usd' },
            totalLlmCostUsd: { $sum: '$costs.llm.cost_usd' },
            totalTavilyCostUsd: { $sum: '$costs.tavily.cost_usd' },
            totalTinyfishCostUsd: { $sum: '$costs.tinyfish.cost_usd' },
            lastGenerationAt: { $max: '$created_at' },
          },
        },
        { $sort: { totalCostUsd: -1 } },
        { $limit: 100 },
      ])
      .toArray();

    // Look up emails for aggregated users
    const userIds = perUserAgg.map((u) => u._id).filter(Boolean);
    const userDocs = await users
      .find({ _id: { $in: userIds.map(toObjectId) } }, { projection: { _id: 1, email: 1 } })
      .toArray();

    const userMap = new Map(userDocs.map((u) => [u._id.toString(), u.email]));

    const perUser = perUserAgg.map((item) => {
      const avgCost = item.totalGenerations > 0 ? item.totalCostUsd / item.totalGenerations : 0;
      return {
        user_id: item._id,
        user_email: userMap.get(item._id) || 'Unknown User',
        total_generations: item.totalGenerations,
        total_cost_usd: Math.round(item.totalCostUsd * 100_000) / 100_000,
        average_cost_per_generation_usd: Math.round(avgCost * 100_000) / 100_000,
        llm_cost_usd: Math.round(item.totalLlmCostUsd * 100_000) / 100_000,
        tavily_cost_usd: Math.round(item.totalTavilyCostUsd * 100_000) / 100_000,
        tinyfish_cost_usd: Math.round(item.totalTinyfishCostUsd * 100_000) / 100_000,
        last_generation_at: item.lastGenerationAt,
      };
    });

    const overall = overallAgg[0] || {
      totalCostUsd: 0,
      totalLlmCostUsd: 0,
      totalTavilyCostUsd: 0,
      totalTinyfishCostUsd: 0,
      totalGenerations: 0,
    };

    const avgCostOverall = overall.totalGenerations > 0 ? overall.totalCostUsd / overall.totalGenerations : 0;

    return json({
      overall: {
        total_cost_usd: Math.round(overall.totalCostUsd * 100_000) / 100_000,
        total_generations: overall.totalGenerations,
        average_cost_per_generation_usd: Math.round(avgCostOverall * 100_000) / 100_000,
        breakdown: {
          llm_usd: Math.round(overall.totalLlmCostUsd * 100_000) / 100_000,
          tavily_usd: Math.round(overall.totalTavilyCostUsd * 100_000) / 100_000,
          tinyfish_usd: Math.round(overall.totalTinyfishCostUsd * 100_000) / 100_000,
        },
      },
      per_user: perUser,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
