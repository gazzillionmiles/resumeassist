import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { getCollections } from './db/mongodb.js';
import { toObjectId } from './db/ids.js';

export function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function requireUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    const error = new Error('missing_token');
    error.status = 401;
    throw error;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return payload.sub;
  } catch {
    const error = new Error('invalid_token');
    error.status = 401;
    throw error;
  }
}

export async function requireVerifiedUser(request) {
  const userId = requireUser(request);
  const { users } = await getCollections();
  const user = await users.findOne({ _id: toObjectId(userId) });
  if (!user) {
    const error = new Error('user_not_found');
    error.status = 401;
    throw error;
  }
  if (!user.emailVerified) {
    const error = new Error('email_not_verified');
    error.status = 403;
    throw error;
  }
  return userId;
}

export function signToken(userId, payloadExtra = {}) {
  return jwt.sign({ sub: userId, ...payloadExtra }, config.jwtSecret, { expiresIn: '30d' });
}

export function hashVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  const expiryMinutes = config.emailVerificationExpiryMinutes || 30;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}
