// In-memory sliding window rate limiter for Next.js Route Handlers

const ipHits = new Map();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipHits.entries()) {
    if (now - record.resetTime > 60000) {
      ipHits.delete(key);
    }
  }
}, 300000);

export function rateLimit(request, { limit = 30, windowMs = 60000, keyPrefix = '' } = {}) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();

  let record = ipHits.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    ipHits.set(key, record);
    return { success: true, remaining: limit - 1 };
  }

  record.count += 1;
  if (record.count > limit) {
    return { success: false, remaining: 0, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }

  return { success: true, remaining: limit - record.count };
}
