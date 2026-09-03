// In-memory sliding window rate limiter for Next.js Route Handlers

const rateLimitHits = new Map();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitHits.entries()) {
    if (now - record.resetTime > 60000) {
      rateLimitHits.delete(key);
    }
  }
}, 300000);

/**
 * Extracts client IP address safely from standard headers.
 *
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  if (!request || !request.headers) return '127.0.0.1';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  return '127.0.0.1';
}

/**
 * Extracts client device fingerprint from headers if provided by the client.
 *
 * @param {Request} request
 * @returns {string|null}
 */
export function getClientFingerprint(request) {
  if (!request || !request.headers) return null;
  return (
    request.headers.get('x-device-fingerprint') ||
    request.headers.get('x-client-fingerprint') ||
    request.headers.get('x-fingerprint') ||
    null
  );
}

/**
 * Checks in-memory sliding window rate limit.
 *
 * @param {Request} request
 * @param {object} options
 * @param {number} [options.limit=30]
 * @param {number} [options.windowMs=60000]
 * @param {string} [options.keyPrefix='']
 * @param {string} [options.userId]
 * @param {string} [options.fingerprint]
 * @returns {{ success: boolean, remaining: number, retryAfter?: number }}
 */
export function rateLimit(
  request,
  { limit = 30, windowMs = 60000, keyPrefix = '', userId = null, fingerprint = null } = {}
) {
  const ip = getClientIp(request);
  const fp = fingerprint || getClientFingerprint(request);

  // Construct rate limit key
  let keyParts = [keyPrefix || 'global', ip];
  if (userId) keyParts.push(`u_${userId}`);
  if (fp) keyParts.push(`fp_${fp}`);
  const key = keyParts.join(':');

  const now = Date.now();

  let record = rateLimitHits.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitHits.set(key, record);
    return { success: true, remaining: limit - 1 };
  }

  record.count += 1;
  if (record.count > limit) {
    return {
      success: false,
      remaining: 0,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  return { success: true, remaining: limit - record.count };
}
