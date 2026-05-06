type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

// In-memory limiter for short-lived API protection (edge-friendly, best-effort).
const buckets = new Map<string, RateLimitState>();

const now = () => Date.now();

const pruneExpired = () => {
  const current = now();
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= current) {
      buckets.delete(key);
    }
  }
};

export const rateLimit = (key: string, limit: number, windowMs: number): RateLimitResult => {
  pruneExpired();
  const current = now();
  const record = buckets.get(key);

  if (!record || record.resetAt <= current) {
    const resetAt = current + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  buckets.set(key, record);
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
};
