import { purgeExpiredAccounts } from '@/lib/server/account.js';
import { json, options, handleError } from '@/lib/server/http.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_PURGE_SECRET;

    // Reject if no secret configured or invalid auth token
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return json({ error: 'unauthorized', message: 'Unauthorized purge request' }, { status: 401 });
    }

    const results = await purgeExpiredAccounts();
    return json({
      success: true,
      results,
    });
  } catch (error) {
    return handleError(error);
  }
}
