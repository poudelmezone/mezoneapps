import fs from 'node:fs';
import { Readable } from 'node:stream';
import { registerDownload } from '@/lib/apps';
import { fail } from '@/lib/http';
import { resolveStoredApk } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * APKs live outside the web root. This route is the only way to reach them:
 * it validates the release id, bumps the counters, then streams the file as an
 * attachment. No directory listing, no path from the client.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ releaseId: string }> }) {
  const { releaseId } = await params;

  // Basic shape check before touching the database.
  if (!/^[a-f0-9-]{8,64}$/i.test(releaseId)) return fail('Not found', 404);

  const release = registerDownload(releaseId);
  if (!release) return fail('This build is no longer available.', 404);

  const filePath = resolveStoredApk(release.stored_name);
  if (!fs.existsSync(filePath)) return fail('The file is missing on the server.', 410);

  const stream = Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream;

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
