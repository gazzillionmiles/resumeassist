import jwt from 'jsonwebtoken';
import { config } from './config.js';

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

export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '30d' });
}
