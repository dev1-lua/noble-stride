// Best-effort in-memory rate limiter (per-process; resets on deploy — fine at
// this scale, swap for a table/redis when the app scales out).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Undo the most recent `rateLimit` charge on a key.
 *
 * For a brute-force gate what matters is FAILED attempts: an office behind one
 * NAT can easily make 20 successful sign-ins in ten minutes, and locking them
 * out protects nobody. Callers therefore charge the attempt up front — so a
 * flood still trips the limit even if the process dies mid-request — and refund
 * it once the attempt is known to have succeeded.
 */
export function refundRateLimit(key: string): void {
  const bucket = buckets.get(key);
  if (bucket && bucket.count > 0) bucket.count -= 1;
}

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
