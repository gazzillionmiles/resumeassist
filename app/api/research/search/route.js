import { z } from 'zod';
import { requireVerifiedUser } from '@/lib/server/auth';
import { searchCompanyNews } from '@/lib/server/services/tavily';
import { json, options, handleError } from '@/lib/server/http';

const schema = z.object({
  company: z.string().min(1),
  roleTitle: z.string().optional(),
});

export const runtime = 'nodejs';
export async function OPTIONS() {
  return options();
}

export async function POST(request) {
  try {
    await requireVerifiedUser(request);
    const { company, roleTitle } = schema.parse(await request.json());
    console.log(`[api/research/search] Request received for company: "${company}", roleTitle: "${roleTitle || ''}"`);

    const sources = await searchCompanyNews({ company, roleTitle });
    console.log(`[api/research/search] Returning ${sources.length} sources to frontend.`);

    return json({
      company,
      roleTitle: roleTitle || null,
      sources,
    });
  } catch (e) {
    console.error('[api/research/search] Error:', e.message);
    return handleError(e);
  }
}
