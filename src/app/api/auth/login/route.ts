import { NextResponse } from 'next/server';
import {
  createSession,
  ensureBootstrapAdmin,
  findUserByUsername,
  verifyOrigin,
  verifyPassword,
} from '@/lib/auth';
import { handleError, fail } from '@/lib/http';
import { clientIp, pruneRateLimits, rateLimit, resetRateLimit } from '@/lib/rate-limit';
import { asString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);

    await ensureBootstrapAdmin();
    await pruneRateLimits();

    const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
    const username = asString(body?.username ?? null).trim().toLowerCase();
    const password = asString(body?.password ?? null);

    if (!username || !password) return fail('Username and password are required.', 400);

    const ip = clientIp(req);
    const key = `login:${ip}:${username}`;
    const limit = await rateLimit(key, MAX_ATTEMPTS, WINDOW_MS);

    if (!limit.ok) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${limit.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      );
    }

    const user = await findUserByUsername(username);

    // Constant-ish work whether or not the user exists (bcrypt on a dummy hash).
    const valid = user
      ? verifyPassword(password, user.password_hash)
      : verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');

    if (!user || !valid) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      return fail('Invalid username or password.', 401);
    }

    await resetRateLimit(key);

    const session = await createSession(user.id, req.headers.get('user-agent'));
    return NextResponse.json({ ok: true, csrfToken: session.csrfToken, username: session.username });
  } catch (error) {
    return handleError(error);
  }
}
