import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { addRelease, getAppById } from '@/lib/apps';
import { fail, handleError } from '@/lib/http';
import { assertUploadRef, readRequest } from '@/lib/payload';
import { MAX_APK_BYTES, registerApk, storeApk } from '@/lib/uploads';
import { optionalString, requiredString, ValidationError } from '@/lib/validation';

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
    if (!(await getAppById(id))) return fail('App not found.', 404);

    const { form, apk } = await readRequest(req);
    const version = requiredString(form.get('version'), 'Version', { max: 40 });
    const changelog = optionalString(form.get('changelog'), 'Changelog', { max: 10000 });

    let stored;

    if (apk) {
      assertUploadRef(apk, 'apk');
      if (apk.size > MAX_APK_BYTES) throw new ValidationError('APK is too large.');
      stored = await registerApk({
        storedName: apk.url,
        fileName: apk.name || 'upload.apk',
        fileSize: apk.size,
        sha256: apk.sha256 ?? '',
      });
    } else {
      const file = form.get('apk');
      if (!file || typeof file !== 'object' || !('arrayBuffer' in file) || (file as File).size === 0) {
        return fail('Choose an .apk file to upload.', 400);
      }
      stored = await storeApk(file as File);
    }

    const releaseId = await addRelease({
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
