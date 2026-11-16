import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { deleteRelease } from '@/lib/apps';
import { fail, handleError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/admin/releases/[id] — removes the build and its file. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail('Unauthorized.', 401);
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
    if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    const { id } = await params;
    await deleteRelease(id);
    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
