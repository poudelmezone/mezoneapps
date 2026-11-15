import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { addRelease, getAppById } from '@/lib/apps';
import { fail, handleError } from '@/lib/http';
import { storeApk } from '@/lib/uploads';
import { optionalString, requiredString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/apps/[id]/releases — upload a new APK build. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail('Unauthorized.', 401);
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
    if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    const { id } = await params;
    if (!getAppById(id)) return fail('App not found.', 404);

    const form = await req.formData();
    const apk = form.get('apk');
    if (!apk || typeof apk !== 'object' || !('arrayBuffer' in apk) || (apk as File).size === 0) {
      return fail('Choose an .apk file to upload.', 400);
    }

    const version = requiredString(form.get('version'), 'Version', { max: 40 });
    const changelog = optionalString(form.get('changelog'), 'Changelog', { max: 10000 });

    const stored = await storeApk(apk as File);
    const releaseId = addRelease({
      appId: id,
      version,
      changelog,
      fileName: stored.fileName,
      storedName: stored.storedName,
      fileSize: stored.fileSize,
      sha256: stored.sha256,
    });

    return Response.json({ ok: true, releaseId }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
