import { getCollections } from '../../../../lib/server/db/mongodb.js';
import { hashVerificationToken, signToken } from '../../../../lib/server/auth.js';
import { isProfileComplete } from '../../../../lib/server/profile.js';
import { json, options, handleError } from '../../../../lib/server/http.js';
import { rateLimit } from '../../../../lib/server/rateLimit.js';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

async function verifyToken(request, rawToken) {
  const limiter = rateLimit(request, { limit: 20, windowMs: 60000, keyPrefix: 'auth_verify' });
  if (!limiter.success) {
    return json({ error: 'too_many_requests', message: 'Too many verification attempts. Please try again in a minute.' }, { status: 429 });
  }

  if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
    return json({ error: 'invalid_token', message: 'Verification token is required.' }, { status: 400 });
  }

  const tokenHash = hashVerificationToken(rawToken.trim());
  const { users, profiles } = await getCollections();
  const user = await users.findOne({ emailVerificationTokenHash: tokenHash });

  if (!user) {
    return json({
      error: 'invalid_token',
      message: 'This verification link is invalid or has already been used.',
    }, { status: 400 });
  }

  if (user.emailVerificationExpiresAt && new Date() > new Date(user.emailVerificationExpiresAt)) {
    return json({
      error: 'token_expired',
      message: 'Your verification link has expired. Please request a new one.',
    }, { status: 400 });
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        updated_at: new Date(),
      },
    }
  );

  const profile = await profiles.findOne({ user_id: user._id.toString() });
  const token = signToken(user._id.toString());
  return json({
    success: true,
    message: 'Email verified successfully.',
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      emailVerified: true,
      is_profile_complete: isProfileComplete(profile),
    },
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    return await verifyToken(request, token);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request) {
  try {
    let rawToken = null;
    try {
      const body = await request.json();
      rawToken = body?.token;
    } catch {
      const { searchParams } = new URL(request.url);
      rawToken = searchParams.get('token');
    }
    return await verifyToken(request, rawToken);
  } catch (error) {
    return handleError(error);
  }
}
