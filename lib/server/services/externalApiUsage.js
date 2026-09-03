import { getCollections } from '../db/mongodb.js';
import { calculateTavilyCost, calculateTinyFishCost } from './pricing.js';

/**
 * Records external API provider calls (Tavily, TinyFish) into MongoDB.
 */
export async function recordExternalApiCall({
  userId = null,
  generationId = null,
  provider = 'unknown',
  operation = 'unknown',
  endpoint = '',
  itemsCount = 1, // search count for Tavily, URL count for TinyFish
  latencyMs = 0,
  status = 'success',
  errorMessage = null,
  startedAt = null,
  completedAt = null,
  metadata = {},
}) {
  try {
    const { externalApiLogs } = await getCollections();
    const now = new Date();
    const start = startedAt ? new Date(startedAt) : new Date(now.getTime() - latencyMs);
    const end = completedAt ? new Date(completedAt) : now;

    let estimatedCostUsd = 0;
    if (provider === 'tavily') {
      estimatedCostUsd = calculateTavilyCost(itemsCount);
    } else if (provider === 'tinyfish') {
      const isSearch = operation.includes('search');
      estimatedCostUsd = calculateTinyFishCost(itemsCount, isSearch ? 'search' : 'fetch');
    } else if (provider === 'linkedin_guest') {
      estimatedCostUsd = 0;
    }

    const doc = {
      user_id: userId ? userId.toString() : null,
      generation_id: generationId ? generationId.toString() : null,
      provider, // 'tavily' | 'tinyfish' | 'linkedin_guest'
      operation, // 'tavily_search' | 'tinyfish_jd_fetch' | 'tinyfish_company_fetch' | 'linkedin_guest_jd_fetch'
      endpoint,
      items_count: Number(itemsCount) || 1,
      estimated_cost_usd: estimatedCostUsd,
      latency_ms: Number(latencyMs) || 0,
      status: status || 'success',
      error_message: errorMessage || null,
      metadata: metadata || {},
      started_at: start,
      completed_at: end,
      created_at: now,
    };

    await externalApiLogs.insertOne(doc);
    return doc;
  } catch (err) {
    console.error('[externalApiUsage] Failed to record API usage log:', err.message);
    return null;
  }
}

/**
 * Aggregates all external API usage for a specific generation.
 */
export async function getGenerationExternalApiUsage(generationId) {
  if (!generationId) return { tavily: null, tinyfish: null };
  const { externalApiLogs } = await getCollections();

  const logs = await externalApiLogs
    .find({ generation_id: generationId.toString() })
    .toArray();

  let tavilyCalls = 0;
  let tavilyQueries = 0;
  let tavilyCostUsd = 0;
  let tavilyLatencyMs = 0;

  let tinyfishCalls = 0;
  let tinyfishUrls = 0;
  let tinyfishSearches = 0;
  let tinyfishCostUsd = 0;
  let tinyfishLatencyMs = 0;

  let linkedinGuestCalls = 0;
  let linkedinGuestSuccessCount = 0;
  let linkedinGuestErrorCount = 0;
  let linkedinGuestLatencyMs = 0;

  for (const log of logs) {
    if (log.provider === 'tavily') {
      tavilyCalls++;
      tavilyQueries += log.items_count || 1;
      tavilyCostUsd += log.estimated_cost_usd || 0;
      tavilyLatencyMs += log.latency_ms || 0;
    } else if (log.provider === 'tinyfish') {
      tinyfishCalls++;
      if ((log.operation || '').includes('search')) {
        tinyfishSearches += log.items_count || 1;
      } else {
        tinyfishUrls += log.items_count || 1;
      }
      tinyfishCostUsd += log.estimated_cost_usd || 0;
      tinyfishLatencyMs += log.latency_ms || 0;
    } else if (log.provider === 'linkedin_guest') {
      linkedinGuestCalls++;
      linkedinGuestLatencyMs += log.latency_ms || 0;
      if (log.status === 'success') {
        linkedinGuestSuccessCount++;
      } else {
        linkedinGuestErrorCount++;
      }
    }
  }

  return {
    tavily: {
      calls_count: tavilyCalls,
      queries_count: tavilyQueries,
      cost_usd: Math.round(tavilyCostUsd * 10_000_000) / 10_000_000,
      latency_ms: tavilyLatencyMs,
    },
    tinyfish: {
      calls_count: tinyfishCalls,
      urls_count: tinyfishUrls,
      searches_count: tinyfishSearches,
      cost_usd: Math.round(tinyfishCostUsd * 10_000_000) / 10_000_000,
      latency_ms: tinyfishLatencyMs,
    },
    linkedin_guest: {
      calls_count: linkedinGuestCalls,
      success_count: linkedinGuestSuccessCount,
      error_count: linkedinGuestErrorCount,
      cost_usd: 0,
      latency_ms: linkedinGuestLatencyMs,
    },
  };
}
