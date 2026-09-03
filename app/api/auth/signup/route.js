import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getCollections } from '@/lib/server/db/mongodb';
import { signToken, generateVerificationToken } from '@/lib/server/auth';
import { sendVerificationEmail } from '@/lib/server/services/email';
import { FREE_CREDITS } from '@/lib/server/services/credits';
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
    const { users, creditTransactions } = await getCollections();
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return json({ error: 'email_taken', message: 'An account with this email already exists.' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

    const userId = new ObjectId();
    await users.insertOne({
      _id: userId,
      email: normalizedEmail,
      password_hash: hash,
      emailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
      free_credits: FREE_CREDITS,
      purchased_credits: 0,
      free_credits_granted: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await creditTransactions.insertOne({
      user_id: userId,
      type: 'free_grant',
      amount: FREE_CREDITS,
      generation_id: null,
      created_at: new Date(),
      metadata: { source: 'welcome_bonus' },
    });

    let emailSent = false;
    try {
      await sendVerificationEmail({ to: normalizedEmail, token: rawToken });
      emailSent = true;
    } catch (mailError) {
      console.error('[signup] Failed to send verification email:', mailError.message);
    }

    return json({
      token: signToken(userId.toString()),
      user: {
        id: userId.toString(),
        email: normalizedEmail,
        emailVerified: false,
        credits: {
          free: FREE_CREDITS,
          purchased: 0,
          total: FREE_CREDITS,
        },
      },
      emailSent,
      message: 'Account created. Please verify your email.',
    }, { status: 201 });
  } catch (error) { return handleError(error); }
}
