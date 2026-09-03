import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/server/db/mongodb';
import { requireVerifiedUser } from '@/lib/server/auth';
import { json, options, handleError } from '@/lib/server/http';

const createSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  roleTitle: z.string().optional().default(''),
  tone: z.string().optional().default('warm_professional'),
  emailSubject: z.string().optional().default(''),
  emailBody: z.string().optional().default(''),
  linkedinMessage: z.string().optional().default(''),
  wasCopiedOrShared: z.boolean().optional().default(false),
});

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    const uid = await requireVerifiedUser(request);
    const { generations } = await getCollections();
    const rows = await generations.find({ user_id: uid }).sort({ created_at: -1 }).limit(100).toArray();
    return json(
      rows.map((r) => ({
        id: r._id.toString(),
        generation_type: r.generation_type || (r.fetch_status === 'company_search' ? 'company_outreach' : 'job_outreach'),
        company_name: r.company_name,
        role_title: r.role_title,
        target_people: r.target_people || null,
        selected_person: r.selected_person || null,
        tone: r.tone,
        fetch_status: r.fetch_status,
        was_edited: r.was_edited,
        was_copied_or_shared: r.was_copied_or_shared,
        email_subject: r.email_subject,
        email_output: r.email_output,
        linkedin_output: r.linkedin_output,
        company_research: r.company_research || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }))
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request) {
  try {
    const uid = await requireVerifiedUser(request);
    const body = createSchema.parse(await request.json());
    const { generations } = await getCollections();
    const generationId = new ObjectId();
    const createdAt = new Date();

    const doc = {
      _id: generationId,
      user_id: uid,
      job_url: null,
      jd_raw_text: '',
      jd_structured: {
        company: body.companyName,
        role_title: body.roleTitle,
      },
      fetch_status: 'manual_entry',
      fetch_source_domain: null,
      tone: body.tone,
      company_research: null,
      email_subject: body.emailSubject,
      email_output: body.emailBody,
      linkedin_output: body.linkedinMessage,
      company_name: body.companyName,
      role_title: body.roleTitle || null,
      was_edited: false,
      was_copied_or_shared: body.wasCopiedOrShared,
      created_at: createdAt,
      updated_at: createdAt,
    };

    await generations.insertOne(doc);

    return json(
      {
        id: generationId.toString(),
        company_name: doc.company_name,
        role_title: doc.role_title,
        tone: doc.tone,
        fetch_status: doc.fetch_status,
        was_edited: doc.was_edited,
        was_copied_or_shared: doc.was_copied_or_shared,
        email_subject: doc.email_subject,
        email_output: doc.email_output,
        linkedin_output: doc.linkedin_output,
        created_at: doc.created_at,
      },
      { status: 201 }
    );
  } catch (e) {
    return handleError(e);
  }
}
