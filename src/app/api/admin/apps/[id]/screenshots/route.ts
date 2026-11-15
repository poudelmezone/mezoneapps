import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { addScreenshot, deleteScreenshot, getAppById } from '@/lib/apps';
import { fail, handleError } from '@/lib/http';
import { MAX_SCREENSHOTS, storeImage } from '@/lib/uploads';
import { ValidationError } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/apps/[id]/screenshots — add one screenshot. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail('Unauthorized.', 401);
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
    if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    const { id } = await params;
    const app = getAppById(id);
    if (!app) return fail('App not found.', 404);
    if (app.screenshots.length >= MAX_SCREENSHOTS) {
      throw new ValidationError(`You can have at most ${MAX_SCREENSHOTS} screenshots.`);
    }

    const form = await req.formData();
    const file = form.get('screenshot');
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || (file as File).size === 0) {
      return fail('Choose an image to upload.', 400);
    }

    const stored = await storeImage(file as File);
    addScreenshot(id, stored.id);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/** DELETE /api/admin/screenshots/[id] is handled by the sibling route. */
