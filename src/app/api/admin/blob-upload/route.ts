import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getSession, verifyOrigin } from '@/lib/auth';
import { MAX_APK_BYTES, MAX_IMAGE_BYTES } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Signs short-lived upload tokens so the browser can send an APK straight to
 * object storage. This is what makes uploads larger than Vercel's 4.5 MB
 * function-body limit possible. Only a signed-in admin can obtain a token.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: 'Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN or upload on a host with a writable disk.' },
      { status: 503 },
    );
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const session = await getSession();
        if (!session) throw new Error('Unauthorized.');
        if (!verifyOrigin(req)) throw new Error('Cross-origin request blocked.');

        const isApk = pathname.toLowerCase().endsWith('.apk');

        return {
          allowedContentTypes: isApk
            ? ['application/vnd.android.package-archive', 'application/octet-stream']
            : ['image/png', 'image/jpeg', 'image/webp'],
          maximumSizeInBytes: isApk ? MAX_APK_BYTES : MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        /* Nothing to do: the admin form posts the metadata afterwards. */
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Upload rejected.' }, { status: 400 });
  }
}
