import { config } from '../config.js';

/**
 * Centralized Provider Pricing Configuration
 * Clearly defines provider, service/model, unit, and unit price.
 */
export const PRICING_CONFIG = {
  llm: {
    provider: 'AWS Bedrock / Mantle API',
    models: {
      'openai.gpt-oss-120b': { inputPer1M: 0.15, outputPer1M: 0.60, unit: 'USD per 1M tokens' },
      'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00, unit: 'USD per 1M tokens' },
      'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60, unit: 'USD per 1M tokens' },
      'anthropic.claude-3-5-sonnet-20241022-v2:0': { inputPer1M: 3.00, outputPer1M: 15.00, unit: 'USD per 1M tokens' },
      'anthropic.claude-3-5-sonnet-20240620-v1:0': { inputPer1M: 3.00, outputPer1M: 15.00, unit: 'USD per 1M tokens' },
      'anthropic.claude-3-haiku-20240307-v1:0': { inputPer1M: 0.25, outputPer1M: 1.25, unit: 'USD per 1M tokens' },
      'anthropic.claude-3-sonnet-20240229-v1:0': { inputPer1M: 3.00, outputPer1M: 15.00, unit: 'USD per 1M tokens' },
      'anthropic.claude-3-opus-20240229-v1:0': { inputPer1M: 15.00, outputPer1M: 75.00, unit: 'USD per 1M tokens' },
      'meta.llama3-70b-instruct-v1:0': { inputPer1M: 0.72, outputPer1M: 0.72, unit: 'USD per 1M tokens' },
      'meta.llama3-8b-instruct-v1:0': { inputPer1M: 0.20, outputPer1M: 0.20, unit: 'USD per 1M tokens' },
      'meta.llama3-1-70b-instruct-v1:0': { inputPer1M: 0.72, outputPer1M: 0.72, unit: 'USD per 1M tokens' },
      'meta.llama3-1-8b-instruct-v1:0': { inputPer1M: 0.20, outputPer1M: 0.20, unit: 'USD per 1M tokens' },
      'amazon.titan-text-express-v1': { inputPer1M: 0.20, outputPer1M: 0.60, unit: 'USD per 1M tokens' },
      'amazon.titan-text-lite-v1': { inputPer1M: 0.15, outputPer1M: 0.20, unit: 'USD per 1M tokens' },
      'amazon.nova-pro-v1:0': { inputPer1M: 0.80, outputPer1M: 3.20, unit: 'USD per 1M tokens' },
      'amazon.nova-lite-v1:0': { inputPer1M: 0.06, outputPer1M: 0.24, unit: 'USD per 1M tokens' },
      'amazon.nova-micro-v1:0': { inputPer1M: 0.035, outputPer1M: 0.14, unit: 'USD per 1M tokens' },
      default: { inputPer1M: 0.50, outputPer1M: 1.50, unit: 'USD per 1M tokens' },
    },
  },
  tavily: {
    provider: 'Tavily Search API',
    costPerSearch: process.env.TAVILY_COST_PER_SEARCH
      ? parseFloat(process.env.TAVILY_COST_PER_SEARCH)
      : 0.008, // 1 credit on basic search ($8 / 1,000 queries)
    unit: 'USD per search query',
    isConfigured: true,
  },
  tinyfish: {
    provider: 'TinyFish Fetch & Search API',
    costPerUrlFetch: process.env.TINYFISH_COST_PER_FETCH
      ? parseFloat(process.env.TINYFISH_COST_PER_FETCH)
      : 0.003, // Standard render & extraction ($3 / 1,000 URLs)
    costPerSearch: process.env.TINYFISH_COST_PER_SEARCH
      ? parseFloat(process.env.TINYFISH_COST_PER_SEARCH)
      : 0.005, // Search query ($5 / 1,000 searches)
    unit: 'USD per URL extracted / search query',
    isConfigured: true,
  },
};

/**
 * Calculates estimated LLM cost in USD given model and token counts.
 */
export function calculateLLMCost(modelId, inputTokens = 0, outputTokens = 0) {
  const normModel = (modelId || '').toLowerCase().trim();
  const pricing =
    PRICING_CONFIG.llm.models[normModel] ||
    PRICING_CONFIG.llm.models[modelId] ||
    PRICING_CONFIG.llm.models.default;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  const totalCost = inputCost + outputCost;

  return Math.round(totalCost * 10_000_000) / 10_000_000;
}

/**
 * Calculates Tavily search cost in USD.
 */
export function calculateTavilyCost(searchCount = 1) {
  const cost = searchCount * PRICING_CONFIG.tavily.costPerSearch;
  return Math.round(cost * 10_000_000) / 10_000_000;
}

/**
 * Calculates TinyFish cost in USD based on number of items and operation type (fetch or search).
 */
export function calculateTinyFishCost(itemsCount = 1, type = 'fetch') {
  const unitPrice =
    type === 'search'
      ? PRICING_CONFIG.tinyfish.costPerSearch
      : PRICING_CONFIG.tinyfish.costPerUrlFetch;
  const cost = itemsCount * unitPrice;
  return Math.round(cost * 10_000_000) / 10_000_000;
}
