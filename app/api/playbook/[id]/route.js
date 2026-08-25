import { toObjectId } from '@/lib/server/db/ids';
import { getCollections } from '@/lib/server/db/mongodb';
import { requireVerifiedUser } from '@/lib/server/auth';
import { noContent, options, handleError, json } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function DELETE(request, { params }) {
  try {
    const uid = await requireVerifiedUser(request);
    const { id } = await params;
    const objectId = toObjectId(id);
    if (!objectId) return json({ error: 'not_found' }, { status: 404 });
    const { playbookExamples } = await getCollections();
    await playbookExamples.deleteOne({ _id: objectId, user_id: uid });
    return noContent();
  } catch (e) { return handleError(e); }
}
