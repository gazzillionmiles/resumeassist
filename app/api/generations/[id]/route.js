import { z } from 'zod';
import { toObjectId } from '@/lib/server/db/ids';
import { getCollections } from '@/lib/server/db/mongodb';
import { requireUser } from '@/lib/server/auth';
import { json, noContent, options, handleError } from '@/lib/server/http';
const patchSchema = z.object({ emailSubject: z.string().optional(), emailOutput: z.string().optional(), linkedinOutput: z.string().optional(), markCopiedOrShared: z.boolean().optional() });
export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request, { params }) {
  try {
    const uid = requireUser(request); const { id } = await params; const objectId = toObjectId(id);
    if (!objectId) return json({ error: 'not_found' }, { status: 404 });
    const { generations } = await getCollections(); const doc = await generations.findOne({ _id: objectId, user_id: uid });
    if (!doc) return json({ error: 'not_found' }, { status: 404 });
    return json({ ...doc, id: doc._id.toString(), _id: undefined });
  } catch (e) { return handleError(e); }
}

export async function PATCH(request, { params }) {
  try {
    const uid = requireUser(request); const { id } = await params; const objectId = toObjectId(id);
    if (!objectId) return json({ error: 'not_found' }, { status: 404 });
    const fields = patchSchema.parse(await request.json()); const set = { was_edited: true, updated_at: new Date() };
    if (fields.emailSubject !== undefined) set.email_subject = fields.emailSubject;
    if (fields.emailOutput !== undefined) set.email_output = fields.emailOutput;
    if (fields.linkedinOutput !== undefined) set.linkedin_output = fields.linkedinOutput;
    if (fields.markCopiedOrShared) set.was_copied_or_shared = true;
    const { generations } = await getCollections();
    const result = await generations.updateOne({ _id: objectId, user_id: uid }, { $set: set });
    if (!result.matchedCount) return json({ error: 'not_found' }, { status: 404 });
    return noContent();
  } catch (e) { return handleError(e); }
}
