// Best-effort in-memory rate limiter (per-process; resets on deploy — fine at
// this scale, swap for a table/redis when the app scales out).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts?: { max?: number; windowMs?: number }): boolean {
  const max = opts?.max ?? 20;
  const windowMs = opts?.windowMs ?? 10 * 60 * 1000;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  return bucket.count <= max;
}
