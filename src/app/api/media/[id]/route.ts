import fs from 'node:fs';
import { Readable } from 'node:stream';
import { fail } from '@/lib/http';
import { resolveStored } from '@/lib/storage';
import { getMedia } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return fail('Not found', 404);

  const media = await getMedia(id);
  if (!media) return fail('Not found', 404);

  const target = resolveStored('media', media.stored_name);
  if (!target) return fail('Not found', 404);

  if (target.type === 'remote') {
    return new Response(null, {
      status: 302,
      headers: { Location: target.url, 'Cache-Control': 'public, max-age=86400' },
    });
  }

  const stream = Readable.toWeb(fs.createReadStream(target.path)) as unknown as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': media.mime,
      'Content-Length': String(media.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
