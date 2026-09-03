import { getCollections } from '../db/mongodb.js';
import { getGenerationLLMUsage } from './llmUsage.js';
import { getGenerationExternalApiUsage } from './externalApiUsage.js';
import { PRICING_CONFIG } from './pricing.js';

/**
 * Calculates statistical percentiles (e.g. median = 50th, p90 = 90th).
 */
function calculatePercentile(numbers, p) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Finalizes and persists complete end-to-end accounting for a generation.
 */
export async function finalizeGenerationAccounting({
  generationId,
  userId,
  startedAt,
  completedAt,
  totalLatencyMs,
  stages = {},
  status = 'completed',
  errorMessage = null,
}) {
  if (!generationId) return null;

  try {
    const { generationCostLogs, generations } = await getCollections();
    const genIdStr = generationId.toString();

    // 1. Fetch aggregated LLM usage for this generation
    const llmUsage = await getGenerationLLMUsage(genIdStr);
    const llmCost = llmUsage?.total_estimated_cost_usd || 0;
    const llmCalls = llmUsage?.total_calls || 0;
    const llmInputTokens = llmUsage?.total_input_tokens || 0;
    const llmOutputTokens = llmUsage?.total_output_tokens || 0;
    const llmTotalTokens = llmUsage?.total_tokens || 0;

    // 2. Fetch aggregated external API usage (Tavily, TinyFish)
    const externalUsage = await getGenerationExternalApiUsage(genIdStr);
    const tavilyCost = externalUsage?.tavily?.cost_usd || 0;
    const tavilyCalls = externalUsage?.tavily?.calls_count || 0;
    const tinyfishCost = externalUsage?.tinyfish?.cost_usd || 0;
    const tinyfishCalls = externalUsage?.tinyfish?.calls_count || 0;
    const tinyfishUrls = externalUsage?.tinyfish?.urls_count || 0;

    // 3. Compute total generation cost
    const totalGenerationCostUsd =
      Math.round((llmCost + tavilyCost + tinyfishCost) * 10_000_000) / 10_000_000;

    const start = startedAt ? new Date(startedAt) : new Date(Date.now() - totalLatencyMs);
    const end = completedAt ? new Date(completedAt) : new Date();

    const accountingDoc = {
      generation_id: genIdStr,
      user_id: userId ? userId.toString() : null,
      status: status || 'completed',
      error_message: errorMessage || null,
      started_at: start,
      completed_at: end,
      total_latency_ms: Number(totalLatencyMs) || (end.getTime() - start.getTime()),
      costs: {
        total_generation_cost_usd: totalGenerationCostUsd,
        llm: {
          cost_usd: llmCost,
          calls_count: llmCalls,
          input_tokens: llmInputTokens,
          output_tokens: llmOutputTokens,
          total_tokens: llmTotalTokens,
        },
        tavily: {
          cost_usd: tavilyCost,
          calls_count: tavilyCalls,
          cost_per_query: PRICING_CONFIG.tavily.costPerSearch,
        },
        tinyfish: {
          cost_usd: tinyfishCost,
          calls_count: tinyfishCalls,
          urls_count: tinyfishUrls,
          searches_count: externalUsage?.tinyfish?.searches_count || 0,
          cost_per_url: PRICING_CONFIG.tinyfish.costPerUrlFetch,
        },
        linkedin_guest: {
          cost_usd: 0,
          calls_count: externalUsage?.linkedin_guest?.calls_count || 0,
          latency_ms: externalUsage?.linkedin_guest?.latency_ms || 0,
        },
      },
      stages: stages || {},
      created_at: new Date(),
    };

    // Upsert into generation_cost_logs
    await generationCostLogs.updateOne(
      { generation_id: genIdStr },
      { $set: accountingDoc },
      { upsert: true }
    );

    // Also update generation document with summarized accounting metadata
    await generations.updateOne(
      { _id: typeof generationId === 'string' ? (await import('../db/ids.js')).toObjectId(generationId) : generationId },
      {
        $set: {
          accounting: {
            total_generation_cost_usd: totalGenerationCostUsd,
            total_latency_ms: accountingDoc.total_latency_ms,
            llm_cost_usd: llmCost,
            tavily_cost_usd: tavilyCost,
            tinyfish_cost_usd: tinyfishCost,
            llm_tokens: {
              input: llmInputTokens,
              output: llmOutputTokens,
              total: llmTotalTokens,
            },
          },
        },
      }
    );

    return accountingDoc;
  } catch (err) {
    console.error('[generationAccounting] Failed to finalize generation accounting:', err.message);
    return null;
  }
}

/**
 * Calculates end-to-end generation economics across the latest completed generations.
 */
export async function getGenerationEconomicsSummary({ limit = 30 } = {}) {
  const { generationCostLogs } = await getCollections();

  const records = await generationCostLogs
    .find({ status: 'completed' })
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();

  const sampleSize = records.length;
  const isSampleSufficient = sampleSize >= 20;

  if (sampleSize === 0) {
    return {
      sample_size: 0,
      sample_status: 'No completed generation records found',
      is_sample_sufficient: false,
      pricing_config: PRICING_CONFIG,
      summary: null,
      generations: [],
    };
  }

  // Extract metric arrays for statistics
  const totalCosts = records.map((r) => r.costs?.total_generation_cost_usd || 0);
  const llmCosts = records.map((r) => r.costs?.llm?.cost_usd || 0);
  const tavilyCosts = records.map((r) => r.costs?.tavily?.cost_usd || 0);
  const tinyfishCosts = records.map((r) => r.costs?.tinyfish?.cost_usd || 0);
  const latencies = records.map((r) => r.total_latency_ms || 0);

  const inputTokens = records.map((r) => r.costs?.llm?.input_tokens || 0);
  const outputTokens = records.map((r) => r.costs?.llm?.output_tokens || 0);
  const totalTokens = records.map((r) => r.costs?.llm?.total_tokens || 0);

  // Stage latencies
  const jdFetchLatencies = records
    .map((r) => r.stages?.jd_fetch?.latency_ms)
    .filter((l) => typeof l === 'number');
  const jdStructureLatencies = records
    .map((r) => r.stages?.jd_structure?.latency_ms)
    .filter((l) => typeof l === 'number');
  const tavilyLatencies = records
    .map((r) => r.stages?.tavily_search?.latency_ms)
    .filter((l) => typeof l === 'number');
  const tinyfishCompanyLatencies = records
    .map((r) => r.stages?.company_sources_fetch?.latency_ms)
    .filter((l) => typeof l === 'number');
  const companyResearchLatencies = records
    .map((r) => r.stages?.company_research?.latency_ms)
    .filter((l) => typeof l === 'number');
  const messageGenLatencies = records
    .map((r) => r.stages?.message_generate?.latency_ms)
    .filter((l) => typeof l === 'number');

  const sum = (arr) => arr.reduce((acc, v) => acc + v, 0);
  const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

  const avgTotalCost = avg(totalCosts);
  const avgLlmCost = avg(llmCosts);
  const avgTavilyCost = avg(tavilyCosts);
  const avgTinyfishCost = avg(tinyfishCosts);

  const avgLatency = avg(latencies);

  const summary = {
    sample_size: sampleSize,
    sample_status: isSampleSufficient
      ? `Sufficient sample size (${sampleSize} generations analyzed)`
      : `Insufficient sample size (${sampleSize} / 20 required for stable statistical baseline)`,
    is_sample_sufficient: isSampleSufficient,
    total_cost_usd: {
      average: Math.round(avgTotalCost * 100_000) / 100_000,
      median: Math.round(calculatePercentile(totalCosts, 50) * 100_000) / 100_000,
      min: Math.round(Math.min(...totalCosts) * 100_000) / 100_000,
      max: Math.round(Math.max(...totalCosts) * 100_000) / 100_000,
      p90: Math.round(calculatePercentile(totalCosts, 90) * 100_000) / 100_000,
    },
    total_latency_seconds: {
      average: Math.round((avgLatency / 1000) * 10) / 10,
      median: Math.round((calculatePercentile(latencies, 50) / 1000) * 10) / 10,
      min: Math.round((Math.min(...latencies) / 1000) * 10) / 10,
      max: Math.round((Math.max(...latencies) / 1000) * 10) / 10,
      p90: Math.round((calculatePercentile(latencies, 90) / 1000) * 10) / 10,
    },
    cost_component_breakdown: {
      llm: {
        average_cost_usd: Math.round(avgLlmCost * 100_000) / 100_000,
        percentage_of_total: avgTotalCost > 0 ? Math.round((avgLlmCost / avgTotalCost) * 1000) / 10 : 0,
        average_input_tokens: Math.round(avg(inputTokens)),
        average_output_tokens: Math.round(avg(outputTokens)),
        average_total_tokens: Math.round(avg(totalTokens)),
      },
      tavily: {
        average_cost_usd: Math.round(avgTavilyCost * 100_000) / 100_000,
        percentage_of_total: avgTotalCost > 0 ? Math.round((avgTavilyCost / avgTotalCost) * 1000) / 10 : 0,
        cost_per_search: PRICING_CONFIG.tavily.costPerSearch,
      },
      tinyfish: {
        average_cost_usd: Math.round(avgTinyfishCost * 100_000) / 100_000,
        percentage_of_total: avgTotalCost > 0 ? Math.round((avgTinyfishCost / avgTotalCost) * 1000) / 10 : 0,
        cost_per_url: PRICING_CONFIG.tinyfish.costPerUrlFetch,
      },
    },
    stage_latency_seconds_average: {
      jd_extraction: jdFetchLatencies.length ? Math.round((avg(jdFetchLatencies) / 1000) * 10) / 10 : 0,
      jd_structuring: jdStructureLatencies.length ? Math.round((avg(jdStructureLatencies) / 1000) * 10) / 10 : 0,
      tavily_search: tavilyLatencies.length ? Math.round((avg(tavilyLatencies) / 1000) * 10) / 10 : 0,
      tinyfish_company_fetch: tinyfishCompanyLatencies.length ? Math.round((avg(tinyfishCompanyLatencies) / 1000) * 10) / 10 : 0,
      company_research_reasoning: companyResearchLatencies.length ? Math.round((avg(companyResearchLatencies) / 1000) * 10) / 10 : 0,
      message_generation: messageGenLatencies.length ? Math.round((avg(messageGenLatencies) / 1000) * 10) / 10 : 0,
    },
  };

  const formattedGenerations = records.map((r) => ({
    generation_id: r.generation_id,
    user_id: r.user_id,
    created_at: r.created_at,
    total_cost_usd: r.costs?.total_generation_cost_usd || 0,
    total_latency_seconds: Math.round(((r.total_latency_ms || 0) / 1000) * 10) / 10,
    llm_cost_usd: r.costs?.llm?.cost_usd || 0,
    tavily_cost_usd: r.costs?.tavily?.cost_usd || 0,
    tinyfish_cost_usd: r.costs?.tinyfish?.cost_usd || 0,
    llm_tokens: r.costs?.llm?.total_tokens || 0,
    stages: r.stages || {},
  }));

  return {
    ...summary,
    pricing_config: PRICING_CONFIG,
    generations: formattedGenerations,
  };
}
