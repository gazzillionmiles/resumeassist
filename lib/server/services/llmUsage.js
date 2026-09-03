import { getCollections } from '../db/mongodb.js';

/**
 * Pricing rates per 1,000,000 tokens (USD)
 */
export const MODEL_PRICING = {
  // OpenAI compatible / Mantle endpoints
  'openai.gpt-oss-120b': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },

  // Anthropic Claude on Bedrock
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'anthropic.claude-3-haiku-20240307-v1:0': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'anthropic.claude-3-sonnet-20240229-v1:0': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'anthropic.claude-3-opus-20240229-v1:0': { inputPer1M: 15.00, outputPer1M: 75.00 },

  // Meta Llama 3 on Bedrock
  'meta.llama3-70b-instruct-v1:0': { inputPer1M: 0.72, outputPer1M: 0.72 },
  'meta.llama3-8b-instruct-v1:0': { inputPer1M: 0.20, outputPer1M: 0.20 },
  'meta.llama3-1-70b-instruct-v1:0': { inputPer1M: 0.72, outputPer1M: 0.72 },
  'meta.llama3-1-8b-instruct-v1:0': { inputPer1M: 0.20, outputPer1M: 0.20 },

  // Amazon Titan & Nova on Bedrock
  'amazon.titan-text-express-v1': { inputPer1M: 0.20, outputPer1M: 0.60 },
  'amazon.titan-text-lite-v1': { inputPer1M: 0.15, outputPer1M: 0.20 },
  'amazon.nova-pro-v1:0': { inputPer1M: 0.80, outputPer1M: 3.20 },
  'amazon.nova-lite-v1:0': { inputPer1M: 0.06, outputPer1M: 0.24 },
  'amazon.nova-micro-v1:0': { inputPer1M: 0.035, outputPer1M: 0.14 },

  // Default fallback rate if model is unrecognized
  default: { inputPer1M: 0.50, outputPer1M: 1.50 },
};

/**
 * Calculates estimated cost in USD given model and token counts.
 * @param {string} modelId
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} Estimated cost in USD
 */
export function calculateEstimatedCost(modelId, inputTokens = 0, outputTokens = 0) {
  const normModel = (modelId || '').toLowerCase().trim();
  const pricing = MODEL_PRICING[normModel] || MODEL_PRICING[modelId] || MODEL_PRICING.default;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  const totalCost = inputCost + outputCost;

  // Round to 7 decimal places for precision
  return Math.round(totalCost * 10_000_000) / 10_000_000;
}

/**
 * Records an individual LLM call's usage and cost into MongoDB.
 */
export async function recordLLMUsage({
  userId = null,
  generationId = null,
  action = 'bedrock_call',
  modelId = 'unknown',
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,
  latencyMs = 0,
  status = 'success',
  errorMessage = null,
  retryCount = 0,
  metadata = {},
}) {
  try {
    const { llmUsageLogs } = await getCollections();
    const costUsd = calculateEstimatedCost(modelId, inputTokens, outputTokens);
    const now = new Date();

    const usageDoc = {
      user_id: userId ? userId.toString() : null,
      generation_id: generationId ? generationId.toString() : null,
      action,
      model_id: modelId,
      input_tokens: Number(inputTokens) || 0,
      output_tokens: Number(outputTokens) || 0,
      total_tokens: Number(totalTokens) || ((Number(inputTokens) || 0) + (Number(outputTokens) || 0)),
      estimated_cost_usd: costUsd,
      latency_ms: Number(latencyMs) || 0,
      status: status || 'success',
      error_message: errorMessage || null,
      retry_count: Number(retryCount) || 0,
      metadata: metadata || {},
      created_at: now,
    };

    await llmUsageLogs.insertOne(usageDoc);
    return usageDoc;
  } catch (err) {
    // Non-blocking: ensure usage recording failure does not crash the core application
    console.error('[llmUsage] Failed to record usage log:', err.message);
    return null;
  }
}

/**
 * Retrieves aggregated LLM usage summary for a user.
 */
export async function getUserLLMUsageSummary(userId) {
  if (!userId) return null;
  const { llmUsageLogs } = await getCollections();

  const pipeline = [
    { $match: { user_id: userId.toString(), status: 'success' } },
    {
      $group: {
        _id: '$user_id',
        total_calls: { $sum: 1 },
        total_input_tokens: { $sum: '$input_tokens' },
        total_output_tokens: { $sum: '$output_tokens' },
        total_tokens: { $sum: '$total_tokens' },
        total_estimated_cost_usd: { $sum: '$estimated_cost_usd' },
      },
    },
  ];

  const results = await llmUsageLogs.aggregate(pipeline).toArray();
  if (!results.length) {
    return {
      userId: userId.toString(),
      total_calls: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_tokens: 0,
      total_estimated_cost_usd: 0,
    };
  }

  const r = results[0];
  return {
    userId: userId.toString(),
    total_calls: r.total_calls,
    total_input_tokens: r.total_input_tokens,
    total_output_tokens: r.total_output_tokens,
    total_tokens: r.total_tokens,
    total_estimated_cost_usd: Math.round(r.total_estimated_cost_usd * 100_000) / 100_000,
  };
}

/**
 * Retrieves total LLM usage for a specific generation.
 */
export async function getGenerationLLMUsage(generationId) {
  if (!generationId) return null;
  const { llmUsageLogs } = await getCollections();

  const pipeline = [
    { $match: { generation_id: generationId.toString() } },
    {
      $group: {
        _id: '$generation_id',
        total_calls: { $sum: 1 },
        total_input_tokens: { $sum: '$input_tokens' },
        total_output_tokens: { $sum: '$output_tokens' },
        total_tokens: { $sum: '$total_tokens' },
        total_estimated_cost_usd: { $sum: '$estimated_cost_usd' },
      },
    },
  ];

  const results = await llmUsageLogs.aggregate(pipeline).toArray();
  if (!results.length) return null;

  const r = results[0];
  return {
    generationId: generationId.toString(),
    total_calls: r.total_calls,
    total_input_tokens: r.total_input_tokens,
    total_output_tokens: r.total_output_tokens,
    total_tokens: r.total_tokens,
    total_estimated_cost_usd: Math.round(r.total_estimated_cost_usd * 100_000) / 100_000,
  };
}
