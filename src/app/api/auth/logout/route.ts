import { NextResponse } from 'next/server';
import { destroySession, getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { fail, handleError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: true });
    if (!verifyOrigin(req) || !verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
