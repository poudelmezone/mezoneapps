import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { addRelease, addScreenshot, createApp } from '@/lib/apps';
import { parseAppForm } from '@/lib/app-form';
import { fail, handleError } from '@/lib/http';
import { assertUploadRef, readRequest } from '@/lib/payload';
import { MAX_APK_BYTES, MAX_SCREENSHOTS, registerApk, registerImage, storeApk, storeImage } from '@/lib/uploads';
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

    const { form, icon, screenshots, apk } = await readRequest(req);
    const input = await parseAppForm(form);

    const apkFile = form.get('apk');
    const hasServerApk = apkFile && typeof apkFile === 'object' && 'arrayBuffer' in apkFile && (apkFile as File).size > 0;

    if (input.published && !hasServerApk && !apk) {
      throw new ValidationError('Upload an APK before publishing — visitors need something to download.');
    }

    // Icon: already uploaded to the blob store, or included in the request.
    if (icon) {
      assertUploadRef(icon, ['png', 'jpg', 'jpeg', 'webp']);
      const stored = await registerImage({ url: icon.url, name: icon.name, size: icon.size });
      input.iconMediaId = stored.id;
    }

    const appId = await createApp(input);

    if (apk) {
      assertUploadRef(apk, 'apk');
      if (apk.size > MAX_APK_BYTES) throw new ValidationError('APK is too large.');
      const stored = await registerApk({
        storedName: apk.url,
        fileName: apk.name || 'upload.apk',
        fileSize: apk.size,
        sha256: apk.sha256 ?? '',
      });
      await addRelease({
        appId,
        version: requiredString(form.get('version'), 'Version', { max: 40 }),
        changelog: optionalString(form.get('releaseChangelog'), 'Changelog', { max: 10000 }),
        fileName: stored.fileName,
        storedName: stored.storedName,
        fileSize: stored.fileSize,
        sha256: stored.sha256,
      });
    }

    if (hasServerApk) {
      const stored = await storeApk(apkFile as File);
      await addRelease({
        appId,
        version: requiredString(form.get('version'), 'Version', { max: 40 }),
        changelog: optionalString(form.get('releaseChangelog'), 'Changelog', { max: 10000 }),
        fileName: stored.fileName,
        storedName: stored.storedName,
        fileSize: stored.fileSize,
        sha256: stored.sha256,
      });
    }

    if (screenshots.length > MAX_SCREENSHOTS) {
      throw new ValidationError(`You can upload at most ${MAX_SCREENSHOTS} screenshots.`);
    }
    for (const shot of screenshots) {
      assertUploadRef(shot, ['png', 'jpg', 'jpeg', 'webp']);
      const stored = await registerImage({ url: shot.url, name: shot.name, size: shot.size });
      await addScreenshot(appId, stored.id);
    }

    const serverShots = form.getAll('screenshots').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (serverShots.length > MAX_SCREENSHOTS) {
      throw new ValidationError(`You can upload at most ${MAX_SCREENSHOTS} screenshots.`);
    }
    for (const shot of serverShots) {
      const stored = await storeImage(shot);
      await addScreenshot(appId, stored.id);
    }

    return Response.json({ ok: true, id: appId, slug: input.slug }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
