import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { APK_DIR, MEDIA_DIR, db, now } from './db';
import { ValidationError } from './validation';
import type { MediaRow } from './types';

export const MAX_APK_BYTES = Math.max(1, Number(process.env.MAX_APK_MB || 100)) * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SCREENSHOTS = 8;

const IMAGE_SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', ext: 'png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/** Real APKs are ZIP archives; the manifest entry name appears in the archive. */
function looksLikeApk(buffer: Buffer): boolean {
  const isZip =
    buffer.length > 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06);

  if (!isZip) return false;

  // The manifest string is stored uncompressed in the central directory.
  const tail = buffer.subarray(Math.max(0, buffer.length - 256 * 1024));
  return (
    buffer.includes(Buffer.from('AndroidManifest.xml', 'ascii')) ||
    tail.includes(Buffer.from('AndroidManifest.xml', 'ascii'))
  );
}

export type StoredApk = {
  fileName: string;
  storedName: string;
  fileSize: number;
  sha256: string;
};

export async function storeApk(file: File): Promise<StoredApk> {
  const original = file.name || 'upload.apk';

  if (!/\.apk$/i.test(original)) {
    throw new ValidationError('Only .apk files are accepted.');
  }
  if (file.size <= 0) {
    throw new ValidationError('The uploaded file is empty.');
  }
  if (file.size > MAX_APK_BYTES) {
    throw new ValidationError(
      `APK is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${process.env.MAX_APK_MB || 100} MB.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!looksLikeApk(buffer)) {
    throw new ValidationError('That file is not a valid Android package (no ZIP header / AndroidManifest.xml).');
  }

  const storedName = `${randomUUID()}.apk`;
  const target = path.join(APK_DIR, storedName);

  // 0o600: only the node process can read the APK. It is never web-served directly.
  fs.writeFileSync(target, buffer, { mode: 0o600 });

  return {
    fileName: path.basename(original).replace(/[^\w.\- ]+/g, '_').slice(0, 120),
    storedName,
    fileSize: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

export type StoredMedia = { id: string; mime: string };

export async function storeImage(file: File): Promise<StoredMedia> {
  if (file.size <= 0) throw new ValidationError('The image is empty.');
  if (file.size > MAX_IMAGE_BYTES) throw new ValidationError('Images must be 5 MB or smaller.');

  const buffer = Buffer.from(await file.arrayBuffer());
  const signature = IMAGE_SIGNATURES.find((entry) => entry.test(buffer));
  if (!signature) throw new ValidationError('Icons and screenshots must be PNG, JPEG or WebP.');

  const id = randomUUID();
  const storedName = `${id}.${signature.ext}`;
  fs.writeFileSync(path.join(MEDIA_DIR, storedName), buffer, { mode: 0o644 });

  db.prepare(
    'INSERT INTO media (id, stored_name, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, storedName, path.basename(file.name).slice(0, 120), signature.mime, buffer.byteLength, now());

  return { id, mime: signature.mime };
}

export function getMedia(id: string): MediaRow | undefined {
  return db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined;
}

export function mediaPath(media: MediaRow): string {
  return path.join(MEDIA_DIR, path.basename(media.stored_name));
}

export function resolveStoredApk(storedName: string): string {
  const safe = path.basename(storedName);
  return path.join(APK_DIR, safe);
}

export function removeFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* already gone — nothing to do */
  }
}

export function deleteMedia(id: string | null | undefined): void {
  if (!id) return;
  const media = getMedia(id);
  if (media) removeFile(mediaPath(media));
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
}
