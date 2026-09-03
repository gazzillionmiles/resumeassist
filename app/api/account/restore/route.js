import { requireUser } from '@/lib/server/auth.js';
import { restoreAccount } from '@/lib/server/account.js';
import { json, options, handleError } from '@/lib/server/http.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function POST(request) {
  try {
    const userId = requireUser(request);
    const result = await restoreAccount({
      userId,
      headers: request.headers,
    });

    return json({
      success: true,
      message: result.message,
      deletion_status: result.deletion_status,
    });
  } catch (error) {
    return handleError(error);
  }
}
