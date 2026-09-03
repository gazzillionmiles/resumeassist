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
    const { users, generations, generationCostLogs, creditTransactions } = await getCollections();

    const [
      totalUsers,
      totalGenerations,
      costAggResult,
      zeroCreditsUsers,
      generationsLast24h,
      totalCreditsConsumed,
    ] = await Promise.all([
      users.countDocuments({ deletion_status: { $ne: 'purged' } }),
      generations.countDocuments(),
      generationCostLogs
        .aggregate([
          { $match: { status: 'completed' } },
          {
            $group: {
              _id: null,
              totalCostUsd: { $sum: '$costs.total_generation_cost_usd' },
              totalLlmCostUsd: { $sum: '$costs.llm.cost_usd' },
              totalTavilyCostUsd: { $sum: '$costs.tavily.cost_usd' },
              totalTinyfishCostUsd: { $sum: '$costs.tinyfish.cost_usd' },
              totalLatencyMs: { $sum: '$total_latency_ms' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      users.countDocuments({
        free_credits: { $lte: 0 },
        purchased_credits: { $lte: 0 },
        deletion_status: { $ne: 'purged' },
      }),
      generations.countDocuments({
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      creditTransactions.countDocuments({ type: 'generation' }),
    ]);

    const costStats = costAggResult[0] || {
      totalCostUsd: 0,
      totalLlmCostUsd: 0,
      totalTavilyCostUsd: 0,
      totalTinyfishCostUsd: 0,
      totalLatencyMs: 0,
      count: 0,
    };

    const avgCostPerGen = costStats.count > 0 ? costStats.totalCostUsd / costStats.count : 0;
    const avgLatencyMs = costStats.count > 0 ? costStats.totalLatencyMs / costStats.count : 0;

    return json({
      summary: {
        total_users: totalUsers,
        total_generations: totalGenerations,
        generations_last_24h: generationsLast24h,
        total_credits_consumed: totalCreditsConsumed,
        zero_credit_users: zeroCreditsUsers,
        total_estimated_cost_usd: Math.round(costStats.totalCostUsd * 100_000) / 100_000,
        average_cost_per_generation_usd: Math.round(avgCostPerGen * 100_000) / 100_000,
        average_latency_seconds: Math.round((avgLatencyMs / 1000) * 10) / 10,
        cost_breakdown: {
          llm_usd: Math.round(costStats.totalLlmCostUsd * 100_000) / 100_000,
          tavily_usd: Math.round(costStats.totalTavilyCostUsd * 100_000) / 100_000,
          tinyfish_usd: Math.round(costStats.totalTinyfishCostUsd * 100_000) / 100_000,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
