import fs from 'node:fs';
import { Readable } from 'node:stream';
import { registerDownload } from '@/lib/apps';
import { fail } from '@/lib/http';
import { resolveStored } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * APKs live outside the web root (or in object storage). This route is the only
 * way to reach them: it validates the release id, bumps the counters, then
 * streams the file as an attachment — or redirects to the stored object on
 * serverless, where the function cannot stream from disk.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  const { releaseId } = await params;

  if (!/^[a-f0-9-]{8,64}$/i.test(releaseId)) return fail('Not found', 404);

  const release = await registerDownload(releaseId);
  if (!release) return fail('This build is no longer available.', 404);

  const target = resolveStored('apk', release.stored_name);
  if (!target) return fail('The file is missing on the server.', 410);

  if (target.type === 'remote') {
    // Counted above; hand the bytes over from object storage.
    return new Response(null, {
      status: 302,
      headers: { Location: target.url, 'Cache-Control': 'no-store' },
    });
  }

  const stream = Readable.toWeb(fs.createReadStream(target.path)) as unknown as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(release.file_size),
      'Content-Disposition': `attachment; filename="${release.file_name.replace(/[^\w.\- ]+/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
