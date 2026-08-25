import { json } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET() { return json({ ok: true, service: 'jd-outreach-next' }); }
