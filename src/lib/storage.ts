import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { APK_DIR, MEDIA_DIR, DATA_DIR } from './db';

/**
 * Two storage backends behind one interface:
 *
 *  - Vercel Blob when BLOB_READ_WRITE_TOKEN is set (serverless has no disk)
 *  - Local disk under DATA_DIR otherwise
 *
 * `stored_name` in the database holds either a bare filename (disk) or an
 * absolute https URL (Blob), so existing installs keep working unchanged.
 */

export const usingBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export type FileKind = 'apk' | 'media';

export function isRemote(stored: string): boolean {
  return /^https?:\/\//i.test(stored);
}

function diskDir(kind: FileKind): string {
  return kind === 'apk' ? APK_DIR : MEDIA_DIR;
}

/** Writes bytes and returns the value to persist in `stored_name` / `stored_name`. */
export async function putFile(options: {
  kind: FileKind;
  body: Buffer;
  extension: string;
  contentType: string;
  originalName: string;
}): Promise<{ stored: string; size: number }> {
  const name = `${randomUUID()}.${options.extension}`;

  if (usingBlob) {
    const { put } = (await import('@vercel/blob')) as typeof import('@vercel/blob');
    const blob = await put(`${options.kind === 'apk' ? 'apks' : 'media'}/${name}`, options.body, {
      access: 'public',
      contentType: options.contentType,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { stored: blob.url, size: options.body.byteLength };
  }

  fs.mkdirSync(diskDir(options.kind), { recursive: true });
  const target = path.join(diskDir(options.kind), name);
  // 0o600: only the server process can read an APK; media files are streamed by a route.
  fs.writeFileSync(target, options.body, { mode: options.kind === 'apk' ? 0o600 : 0o644 });
  return { stored: name, size: options.body.byteLength };
}

/** Resolves a stored value to something a route handler can serve. */
export function resolveStored(
  kind: FileKind,
  stored: string,
): { type: 'remote'; url: string } | { type: 'file'; path: string } | null {
  if (isRemote(stored)) return { type: 'remote', url: stored };

  const safe = path.basename(stored);
  const filePath = path.join(diskDir(kind), safe);
  if (!fs.existsSync(filePath)) return null;
  return { type: 'file', path: filePath };
}

/** Removes the bytes behind a stored value. Missing files are ignored. */
export async function deleteStored(kind: FileKind, stored: string): Promise<void> {
  if (isRemote(stored)) {
    try {
      const { del } = (await import('@vercel/blob')) as typeof import('@vercel/blob');
      await del(stored, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      /* already gone or not ours */
    }
    return;
  }

  try {
    fs.unlinkSync(path.join(diskDir(kind), path.basename(stored)));
  } catch {
    /* already gone */
  }
}

export function dataDir(): string {
  return DATA_DIR;
}
