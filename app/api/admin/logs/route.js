import { requireAdminUser } from '../../../../lib/server/auth.js';
import { getCollections } from '../../../../lib/server/db/mongodb.js';
import { json, options, handleError } from '../../../../lib/server/http.js';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return options();
}

export async function GET(request) {
  try {
    await requireAdminUser(request);
    const { externalApiLogs, accountLifecycleLogs } = await getCollections();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const statusFilter = searchParams.get('status');

    const filter = {};
    if (statusFilter) filter.status = statusFilter;

    // Fetch sanitized external API logs
    const apiLogs = await externalApiLogs
      .find(filter, {
        projection: {
          _id: 1,
          provider: 1,
          operation: 1,
          status: 1,
          items_count: 1,
          latency_ms: 1,
          error_message: 1,
          started_at: 1,
          completed_at: 1,
          user_id: 1,
          generation_id: 1,
        },
      })
      .sort({ started_at: -1 })
      .limit(limit)
      .toArray();

    // Fetch recent lifecycle logs
    const lifecycleLogs = await accountLifecycleLogs
      .find({}, {
        projection: {
          _id: 1,
          user_id: 1,
          event_type: 1,
          details: 1,
          created_at: 1,
        },
      })
      .sort({ created_at: -1 })
      .limit(30)
      .toArray();

    return json({
      api_logs: apiLogs.map((l) => ({
        id: l._id.toString(),
        provider: l.provider,
        operation: l.operation,
        status: l.status,
        items_count: l.items_count || 1,
        latency_ms: l.latency_ms || 0,
        error_message: l.error_message || null,
        user_id: l.user_id || null,
        generation_id: l.generation_id || null,
        timestamp: l.started_at,
      })),
      lifecycle_logs: lifecycleLogs.map((l) => ({
        id: l._id.toString(),
        user_id: l.user_id,
        event_type: l.event_type,
        details: l.details || {},
        timestamp: l.created_at,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}
