import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getCollections } from '@/lib/server/db/mongodb';
import { signToken } from '@/lib/server/auth';
import { json, options, handleError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rateLimit';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function POST(request) {
  try {
    const limiter = rateLimit(request, { limit: 10, windowMs: 60000, keyPrefix: 'auth_login' });
    if (!limiter.success) {
      return json({ error: 'too_many_requests', message: 'Too many login attempts. Please try again in a minute.' }, { status: 429 });
    }

    const { email, password } = schema.parse(await request.json());
    const { users } = await getCollections();
    const user = await users.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return json({ error: 'invalid_credentials' }, { status: 401 });
    }
    return json({ token: signToken(user._id.toString()) });
  } catch (error) { return handleError(error); }
}
