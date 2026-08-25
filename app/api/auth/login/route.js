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
    const normalizedEmail = email.toLowerCase().trim();
    const user = await users.findOne({ email: normalizedEmail });
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return json({ error: 'invalid_credentials', message: 'Invalid email or password.' }, { status: 401 });
    }

    const isVerified = Boolean(user.emailVerified);
    return json({
      token: signToken(user._id.toString()),
      user: {
        id: user._id.toString(),
        email: user.email,
        emailVerified: isVerified,
      },
    });
  } catch (error) { return handleError(error); }
}
