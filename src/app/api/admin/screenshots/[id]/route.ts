import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { deleteScreenshot } from '@/lib/apps';
import { fail, handleError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DELETE /api/admin/screenshots/[id] */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail('Unauthorized.', 401);
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
    if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    const { id } = await params;
    await deleteScreenshot(id);
    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
