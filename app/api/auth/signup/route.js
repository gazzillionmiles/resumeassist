import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getCollections } from '@/lib/server/db/mongodb';
import { signToken } from '@/lib/server/auth';
import { json, options, handleError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rateLimit';
import { ObjectId } from 'mongodb';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function POST(request) {
  try {
    const limiter = rateLimit(request, { limit: 5, windowMs: 60000, keyPrefix: 'auth_signup' });
    if (!limiter.success) {
      return json({ error: 'too_many_requests', message: 'Too many signup attempts. Please try again in a minute.' }, { status: 429 });
    }

    const { email, password } = schema.parse(await request.json());
    const { users } = await getCollections();
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) return json({ error: 'email_taken' }, { status: 409 });
    const hash = await bcrypt.hash(password, 10);
    const result = await users.insertOne({
      _id: new ObjectId(),
      email: normalizedEmail,
      password_hash: hash,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return json({ token: signToken(result.insertedId.toString()) }, { status: 201 });
  } catch (error) { return handleError(error); }
}
