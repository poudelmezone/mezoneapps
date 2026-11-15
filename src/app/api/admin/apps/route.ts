import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { addRelease, addScreenshot, createApp } from '@/lib/apps';
import { parseAppForm } from '@/lib/app-form';
import { fail, handleError } from '@/lib/http';
import { MAX_SCREENSHOTS, storeApk, storeImage } from '@/lib/uploads';
import { optionalString, requiredString, ValidationError } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/apps — create an app, optionally with its first APK build. */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail('Unauthorized.', 401);
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
    if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    const form = await req.formData();
    const input = await parseAppForm(form);

    if (input.published) {
      const apk = form.get('apk');
      const hasApk = apk && typeof apk === 'object' && 'arrayBuffer' in apk && (apk as File).size > 0;
      if (!hasApk) {
        throw new ValidationError('Upload an APK before publishing — visitors need something to download.');
      }
    }

    const appId = createApp(input);

    const apkFile = form.get('apk');
    if (apkFile && typeof apkFile === 'object' && 'arrayBuffer' in apkFile && (apkFile as File).size > 0) {
      const stored = await storeApk(apkFile as File);
      addRelease({
        appId,
        version: requiredString(form.get('version'), 'Version', { max: 40 }),
        changelog: optionalString(form.get('releaseChangelog'), 'Changelog', { max: 10000 }),
        fileName: stored.fileName,
        storedName: stored.storedName,
        fileSize: stored.fileSize,
        sha256: stored.sha256,
      });
    }

    const screenshots = form.getAll('screenshots').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (screenshots.length > MAX_SCREENSHOTS) {
      throw new ValidationError(`You can upload at most ${MAX_SCREENSHOTS} screenshots.`);
    }
    for (const shot of screenshots) {
      const stored = await storeImage(shot);
      addScreenshot(appId, stored.id);
    }

    return Response.json({ ok: true, id: appId, slug: input.slug }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
