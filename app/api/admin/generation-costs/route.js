import { getGenerationEconomicsSummary } from '@/lib/server/services/generationAccounting.js';
import { requireUser } from '@/lib/server/auth.js';
import { json, options, handleError } from '@/lib/server/http.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    // Check either internal admin key or authenticated session
    const authHeader = request.headers.get('authorization') || '';
    const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

    let authorized = false;
    if (adminSecret && authHeader === `Bearer ${adminSecret}`) {
      authorized = true;
    } else {
      try {
        const userId = requireUser(request);
        if (userId) authorized = true;
      } catch {
        authorized = false;
      }
    }

    if (!authorized) {
      return json({ error: 'unauthorized', message: 'Admin authentication required to access cost accounting.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 30;

    const data = await getGenerationEconomicsSummary({ limit });

    return json({
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    return handleError(error);
  }
}
