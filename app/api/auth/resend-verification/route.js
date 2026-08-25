import { z } from 'zod';
import { getCollections } from '@/lib/server/db/mongodb';
import { getBearerToken, generateVerificationToken } from '@/lib/server/auth';
import { sendVerificationEmail } from '@/lib/server/services/email';
import { json, options, handleError } from '@/lib/server/http';
import { rateLimit } from '@/lib/server/rateLimit';
import { toObjectId } from '@/lib/server/db/ids';
import jwt from 'jsonwebtoken';
import { config } from '@/lib/server/config';

const schema = z.object({
  email: z.string().email().optional(),
});

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function POST(request) {
  try {
    const limiter = rateLimit(request, { limit: 3, windowMs: 60000, keyPrefix: 'auth_resend' });
    if (!limiter.success) {
      return json(
        {
          error: 'too_many_requests',
          message: `Too many requests. Please wait ${limiter.retryAfter || 60} seconds before requesting another email.`,
        },
        { status: 429 }
      );
    }

    let email = null;
    try {
      const body = await request.json();
      const parsed = schema.parse(body);
      if (parsed.email) {
        email = parsed.email.toLowerCase().trim();
      }
    } catch {
      // Body may be empty if relying on auth token
    }

    const { users } = await getCollections();
    let user = null;

    if (email) {
      user = await users.findOne({ email });
    } else {
      const token = getBearerToken(request);
      if (token) {
        try {
          const payload = jwt.verify(token, config.jwtSecret);
          if (payload?.sub) {
            user = await users.findOne({ _id: toObjectId(payload.sub) });
          }
        } catch {
          // Token verification failed
        }
      }
    }

    if (!user) {
      // Return generic message to avoid email enumeration
      return json({
        success: true,
        message: 'If an account exists with that email, a verification link has been sent.',
      });
    }

    if (user.emailVerified) {
      return json({
        success: true,
        alreadyVerified: true,
        message: 'Your email is already verified. You can continue to the application.',
      });
    }

    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: expiresAt,
          updated_at: new Date(),
        },
      }
    );

    try {
      await sendVerificationEmail({ to: user.email, token: rawToken });
    } catch (mailError) {
      console.error('[resend-verification] Failed to send verification email:', mailError.message);
      return json({
        error: 'email_send_failed',
        message: 'Failed to send verification email. Please check your SMTP configuration or try again later.',
      }, { status: 500 });
    }

    return json({
      success: true,
      message: 'A fresh verification link has been sent to your email address.',
    });
  } catch (error) {
    return handleError(error);
  }
}
