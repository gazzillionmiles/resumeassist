import { requireVerifiedUser } from '@/lib/server/auth.js';
import { getUserLLMUsageSummary } from '@/lib/server/services/llmUsage.js';
import { json, options, handleError } from '@/lib/server/http.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    const userId = await requireVerifiedUser(request);
    const summary = await getUserLLMUsageSummary(userId);
    return json({
      usage: summary,
    });
  } catch (error) {
    return handleError(error);
  }
}
