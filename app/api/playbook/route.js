import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/server/db/mongodb';
import { requireUser } from '@/lib/server/auth';
import { json, options, handleError } from '@/lib/server/http';

const schema = z.object({ exampleText: z.string().min(20).max(4000), sourceNote: z.string().optional() });
export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    const uid = requireUser(request);
    const { playbookExamples } = await getCollections();
    const rows = await playbookExamples.find({ user_id: uid }).sort({ created_at: -1 }).toArray();
    return json(rows.map((r) => ({ id: r._id.toString(), example_text: r.example_text, source_note: r.source_note, created_at: r.created_at })));
  } catch (e) { return handleError(e); }
}

export async function POST(request) {
  try {
    const uid = requireUser(request);
    const f = schema.parse(await request.json());
    const { playbookExamples } = await getCollections();
    const result = await playbookExamples.insertOne({ _id: new ObjectId(), user_id: uid, example_text: f.exampleText, source_note: f.sourceNote || null, created_at: new Date(), updated_at: new Date() });
    return json({ id: result.insertedId.toString() }, { status: 201 });
  } catch (e) { return handleError(e); }
}
