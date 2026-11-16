import { createHash } from 'node:crypto';
import path from 'node:path';
import { now, one, run } from './db';
import { ValidationError } from './validation';
import { putFile } from './storage';
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
export function looksLikeApk(buffer: Buffer): boolean {
  const isZip =
    buffer.length > 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06);

  if (!isZip) return false;

  // The manifest string is stored uncompressed in the central directory.
  const tail = buffer.subarray(Math.max(0, buffer.length - 256 * 1024));
  return buffer.includes(Buffer.from('AndroidManifest.xml', 'ascii')) || tail.includes(Buffer.from('AndroidManifest.xml', 'ascii'));
}

export type StoredApk = {
  fileName: string;
  storedName: string;
  fileSize: number;
  sha256: string;
};

export function assertApkBuffer(buffer: Buffer, originalName: string): void {
  if (!/\.apk$/i.test(originalName)) throw new ValidationError('Only .apk files are accepted.');
  if (buffer.length === 0) throw new ValidationError('The uploaded file is empty.');
  if (buffer.length > MAX_APK_BYTES) {
    throw new ValidationError(
      `APK is too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is ${process.env.MAX_APK_MB || 100} MB.`,
    );
  }
  if (!looksLikeApk(buffer)) {
    throw new ValidationError('That file is not a valid Android package (no ZIP header / AndroidManifest.xml).');
  }
}

export async function storeApk(file: File): Promise<StoredApk> {
  const original = file.name || 'upload.apk';
  if (file.size > MAX_APK_BYTES) {
    throw new ValidationError(
      `APK is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${process.env.MAX_APK_MB || 100} MB.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  assertApkBuffer(buffer, original);

  const stored = await putFile({
    kind: 'apk',
    body: buffer,
    extension: 'apk',
    contentType: 'application/vnd.android.package-archive',
    originalName: original,
  });

  return {
    fileName: path.basename(original).replace(/[^\w.\- ]+/g, '_').slice(0, 120),
    storedName: stored.stored,
    fileSize: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

/** Registers an upload that already happened directly in object storage. */
export async function registerApk(input: {
  storedName: string;
  fileName: string;
  fileSize: number;
  sha256: string;
}): Promise<StoredApk> {
  if (!/^https?:\/\//i.test(input.storedName)) {
    throw new ValidationError('Unrecognised upload reference.');
  }
  return {
    fileName: path.basename(input.fileName || 'upload.apk').replace(/[^\w.\- ]+/g, '_').slice(0, 120),
    storedName: input.storedName,
    fileSize: input.fileSize,
    sha256: input.sha256,
  };
}

export type StoredMedia = { id: string; mime: string };

export async function storeImage(file: File): Promise<StoredMedia> {
  if (file.size <= 0) throw new ValidationError('The image is empty.');
  if (file.size > MAX_IMAGE_BYTES) throw new ValidationError('Images must be 5 MB or smaller.');

  const buffer = Buffer.from(await file.arrayBuffer());
  return storeImageBuffer(buffer, file.name);
}

export async function storeImageBuffer(buffer: Buffer, originalName: string): Promise<StoredMedia> {
  if (buffer.length === 0) throw new ValidationError('The image is empty.');
  if (buffer.length > MAX_IMAGE_BYTES) throw new ValidationError('Images must be 5 MB or smaller.');

  const signature = IMAGE_SIGNATURES.find((entry) => entry.test(buffer));
  if (!signature) throw new ValidationError('Icons and screenshots must be PNG, JPEG or WebP.');

  const stored = await putFile({
    kind: 'media',
    body: buffer,
    extension: signature.ext,
    contentType: signature.mime,
    originalName,
  });

  const id = crypto.randomUUID();
  await run('INSERT INTO media (id, stored_name, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    stored.stored,
    path.basename(originalName).slice(0, 120),
    signature.mime,
    buffer.byteLength,
    now(),
  ]);

  return { id, mime: signature.mime };
}

/** Registers an image that was uploaded straight to object storage by the browser. */
export async function registerImage(input: { url: string; name: string; size: number }): Promise<StoredMedia> {
  if (!/^https?:\/\//i.test(input.url)) throw new ValidationError('Unrecognised image reference.');

  const lower = input.url.toLowerCase();
  const mime = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : null;
  if (!mime) throw new ValidationError('Icons and screenshots must be PNG, JPEG or WebP.');

  const id = crypto.randomUUID();
  await run('INSERT INTO media (id, stored_name, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    input.url,
    path.basename(input.name || 'image').slice(0, 120),
    mime,
    input.size,
    now(),
  ]);

  return { id, mime };
}

export async function getMedia(id: string): Promise<MediaRow | undefined> {
  return one<MediaRow>('SELECT * FROM media WHERE id = ?', [id]);
}
