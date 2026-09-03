import { requireUser } from '../../../lib/server/auth.js';
import { getUserCredits } from '../../../lib/server/services/credits.js';
import { json, options, handleError } from '../../../lib/server/http.js';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return options();
}

export async function GET(request) {
  try {
    const userId = requireUser(request);
    const credits = await getUserCredits(userId);

    return json({
      freeCredits: credits.freeCredits,
      purchasedCredits: credits.purchasedCredits,
      totalCredits: credits.totalCredits,
    });
  } catch (error) {
    return handleError(error);
  }
}
