import OpenAI from 'openai';
import { getTokenProvider } from '@aws/bedrock-token-generator';
import { config } from '../config.js';

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
 * Calls Bedrock (via Mantle OpenAI-compatible endpoint) and returns the raw text of the model's reply.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ maxTokens?: number, temperature?: number }} opts
 */
export async function callBedrock(systemPrompt, userPrompt, opts = {}) {
  const client = await getClient();
  const response = await client.chat.completions.create({
    model: config.bedrock.modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1200,
  });

  const text = response.choices?.[0]?.message?.content?.trim() || '';

  if (!text) {
    throw new Error('Bedrock returned an empty response');
  }
  return text;
}

/**
 * Calls Bedrock expecting strict JSON back, with one retry using a stricter instruction
 * if the first response fails to parse — per PRD Section 8 (Bedrock JSON parse failure).
 */
export async function callBedrockJSON(systemPrompt, userPrompt, opts = {}) {
  const strictSuffix = '\n\nReturn ONLY valid JSON. No markdown fences, no preamble, no explanation.';

  const attempt = async (extraStrict) => {
    const raw = await callBedrock(systemPrompt + (extraStrict ? strictSuffix : ''), userPrompt, opts);
    console.log('Bedrock raw response:', raw);
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  };

  try {
    return await attempt(false);
  } catch (firstErr) {
    try {
      return await attempt(true);
    } catch (secondErr) {
      const err = new Error('Bedrock did not return parseable JSON after retry');
      err.cause = secondErr;
      err.name = 'BedrockJSONParseError';
      throw err;
    }
  }
}
