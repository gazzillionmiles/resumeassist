import { getCollections } from '@/lib/server/db/mongodb';
import { requireUser } from '@/lib/server/auth';
import { json, options, handleError } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }
export async function GET(request) {
  try {
    const uid = requireUser(request);
    const { generations } = await getCollections();
    const rows = await generations.find({ user_id: uid }).sort({ created_at: -1 }).limit(100).toArray();
    return json(rows.map((r) => ({ id: r._id.toString(), company_name: r.company_name, role_title: r.role_title, tone: r.tone, fetch_status: r.fetch_status, was_edited: r.was_edited, was_copied_or_shared: r.was_copied_or_shared, created_at: r.created_at })));
  } catch (e) { return handleError(e); }
}
