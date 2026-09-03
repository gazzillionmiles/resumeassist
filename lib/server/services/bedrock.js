import OpenAI from 'openai';
import { getTokenProvider } from '@aws/bedrock-token-generator';
import { config } from '../config.js';
import { recordLLMUsage } from './llmUsage.js';

const provideToken = getTokenProvider();

async function getClient() {
  const token = await provideToken();
  return new OpenAI({
    apiKey: token,
    baseURL: config.bedrock.mantleEndpoint,
    project: 'default',
  });
}

/**
 * Calls Bedrock (via Mantle OpenAI-compatible endpoint) and tracks token and cost usage.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{
 *   maxTokens?: number,
 *   temperature?: number,
 *   userId?: string,
 *   generationId?: string,
 *   action?: string,
 *   retryCount?: number,
 *   returnFull?: boolean,
 * }} opts
 */
export async function callBedrock(systemPrompt, userPrompt, opts = {}) {
  const startTime = Date.now();
  const modelId = config.bedrock.modelId;
  const action = opts.action || 'bedrock_call';
  const userId = opts.userId || null;
  const generationId = opts.generationId || null;
  const retryCount = opts.retryCount || 0;

  let response;
  try {
    const client = await getClient();
    response = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1200,
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    await recordLLMUsage({
      userId,
      generationId,
      action,
      modelId,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs,
      status: 'error',
      errorMessage: err.message,
      retryCount,
    });
    throw err;
  }

  const latencyMs = Date.now() - startTime;
  const text = response.choices?.[0]?.message?.content?.trim() || '';
  const actualModel = response.model || modelId;

  // Extract usage metadata from response
  const usage = response.usage || {};
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens) || 0;
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens) || 0;
  const totalTokens = Number(usage.total_tokens) || (inputTokens + outputTokens);

  // Record usage into centralized MongoDB collection
  const recorded = await recordLLMUsage({
    userId,
    generationId,
    action,
    modelId: actualModel,
    inputTokens,
    outputTokens,
    totalTokens,
    latencyMs,
    status: 'success',
    retryCount,
  });

  if (!text) {
    throw new Error('Bedrock returned an empty response');
  }

  if (opts.returnFull) {
    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd: recorded?.estimated_cost_usd || 0,
        latencyMs,
        modelId: actualModel,
      },
    };
  }

  return text;
}

/**
 * Calls Bedrock expecting strict JSON back, with one retry using a stricter instruction
 * if the first response fails to parse. Tracks usage for both initial attempt and retry.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{
 *   maxTokens?: number,
 *   temperature?: number,
 *   userId?: string,
 *   generationId?: string,
 *   action?: string,
 *   returnWithUsage?: boolean,
 * }} opts
 */
export async function callBedrockJSON(systemPrompt, userPrompt, opts = {}) {
  const strictSuffix = '\n\nReturn ONLY valid JSON. No markdown fences, no preamble, no explanation.';
  const baseAction = opts.action || 'bedrock_json';

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  const attempt = async (extraStrict, retryNum) => {
    const currentAction = retryNum > 0 ? `${baseAction}:retry` : baseAction;
    const res = await callBedrock(
      systemPrompt + (extraStrict ? strictSuffix : ''),
      userPrompt,
      {
        ...opts,
        action: currentAction,
        retryCount: retryNum,
        returnFull: true,
      }
    );

    if (res.usage) {
      totalInputTokens += res.usage.inputTokens;
      totalOutputTokens += res.usage.outputTokens;
      totalCostUsd += res.usage.costUsd;
    }

    const raw = res.text;
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  };

  try {
    const data = await attempt(false, 0);
    if (opts.returnWithUsage) {
      return {
        data,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          costUsd: Math.round(totalCostUsd * 10_000_000) / 10_000_000,
        },
      };
    }
    return data;
  } catch (firstErr) {
    try {
      const data = await attempt(true, 1);
      if (opts.returnWithUsage) {
        return {
          data,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            costUsd: Math.round(totalCostUsd * 10_000_000) / 10_000_000,
          },
        };
      }
      return data;
    } catch (secondErr) {
      const err = new Error('Bedrock did not return parseable JSON after retry');
      err.cause = secondErr;
      err.name = 'BedrockJSONParseError';
      throw err;
    }
  }
}
