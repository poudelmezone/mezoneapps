'use client';

export type UploadRef = {
  url: string;
  name: string;
  size: number;
  sha256?: string;
};

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sends a file straight from the browser to object storage, bypassing the
 * serverless request-body limit. The signed token comes from
 * /api/admin/blob-upload, which requires an admin session.
 */
export async function uploadFile(file: File, kind: 'apk' | 'image'): Promise<UploadRef> {
  const { upload } = await import('@vercel/blob/client');

  const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
  const pathname = `uploads/${Date.now()}-${safeName}`;

  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/admin/blob-upload',
    contentType:
      kind === 'apk' ? 'application/vnd.android.package-archive' : file.type || 'image/png',
  });

  return {
    url: blob.url,
    name: file.name,
    size: file.size,
    sha256: kind === 'apk' ? await sha256Hex(file) : undefined,
  };
}
