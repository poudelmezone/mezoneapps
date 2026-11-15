import { db, now } from './db';

type Bucket = { ok: true; remaining: number } | { ok: false; retryAfter: number };

/**
 * Fixed-window rate limiter backed by SQLite so it survives restarts and works
 * across multiple Node processes sharing the database.
 */
export function rateLimit(key: string, limit: number, windowMs: number): Bucket {
  const timestamp = now();
  const row = db.prepare('SELECT key, count, reset_at FROM rate_limits WHERE key = ?').get(key) as
    | { key: string; count: number; reset_at: number }
    | undefined;

  if (!row || row.reset_at <= timestamp) {
    db.prepare(
      'INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at',
    ).run(key, timestamp + windowMs);
    return { ok: true, remaining: limit - 1 };
  }

  if (row.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((row.reset_at - timestamp) / 1000)) };
  }

  db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').run(key);
  return { ok: true, remaining: limit - row.count - 1 };
}

export function resetRateLimit(key: string): void {
  db.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
}

/** Drop stale buckets; called opportunistically from the login route. */
export function pruneRateLimits(): void {
  db.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(now() - 60_000);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'local';
}
