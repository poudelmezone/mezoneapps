import { now, one, run } from './db';

type Bucket = { ok: true; remaining: number } | { ok: false; retryAfter: number };

/**
 * Fixed-window rate limiter backed by the database, so it survives restarts and
 * works across multiple serverless instances.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<Bucket> {
  const timestamp = now();
  const row = await one<{ count: number; reset_at: number }>('SELECT count, reset_at FROM rate_limits WHERE key = ?', [key]);

  if (!row || Number(row.reset_at) <= timestamp) {
    await run(
      'INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at',
      [key, timestamp + windowMs],
    );
    return { ok: true, remaining: limit - 1 };
  }

  if (Number(row.count) >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((Number(row.reset_at) - timestamp) / 1000)) };
  }

  await run('UPDATE rate_limits SET count = count + 1 WHERE key = ?', [key]);
  return { ok: true, remaining: limit - Number(row.count) - 1 };
}

export async function resetRateLimit(key: string): Promise<void> {
  await run('DELETE FROM rate_limits WHERE key = ?', [key]);
}

/** Drop stale buckets; called opportunistically from the login route. */
export async function pruneRateLimits(): Promise<void> {
  await run('DELETE FROM rate_limits WHERE reset_at < ?', [now() - 60_000]);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'local';
}
