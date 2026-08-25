import { requireVerifiedUser } from '@/lib/server/auth';
import { getCollections } from '@/lib/server/db/mongodb';
import { parseResume } from '@/lib/server/services/resumeParser';
import { uploadResume } from '@/lib/server/services/s3';
import { json, options, handleError } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function OPTIONS() { return options(); }

export async function POST(request) {
  try {
    const uid = await requireVerifiedUser(request);
    const form = await request.formData();
    const file = form.get('resume');
    if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'no_file' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return json({ error: 'file_too_large' }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || 'resume';
    const contentType = file.type || 'application/octet-stream';
    const { rawText, structured, confidence } = await parseResume(buffer, contentType, filename);
    const uploaded = await uploadResume({ userId: uid, filename, contentType, buffer });
    const { profiles } = await getCollections();
    await profiles.updateOne(
      { user_id: uid },
      { $set: {
        resume_raw_text: rawText,
        resume_structured: structured,
        resume_parse_confidence: confidence,
        resume_s3_key: uploaded.key,
        resume_s3_bucket: uploaded.bucket,
        resume_filename: filename,
        resume_content_type: contentType,
        updated_at: new Date(),
      }, $setOnInsert: { user_id: uid, created_at: new Date() } },
      { upsert: true }
    );
    return json({ structured, confidence, storageKey: uploaded.key });
  } catch (e) { return handleError(e); }
}
