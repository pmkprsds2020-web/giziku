// =====================================================================
// CareLivia — Rate Limiting for AI Routes
//
// In-memory sliding-window limiter. Good enough for a single Vercel
// region / low-moderate traffic. Note: Vercel serverless functions are
// stateless between cold starts, so this resets periodically — for
// strict multi-instance limits, back this with Supabase or Upstash
// Redis instead (swap the implementation below, keep the same API).
// =====================================================================

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - bucket.windowStart) };
  }

  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

export function clientKeyFromRequest(req: Request, extra?: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return extra ? `${ip}:${extra}` : ip;
}
