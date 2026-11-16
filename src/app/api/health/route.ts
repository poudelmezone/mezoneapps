import { one, usingPostgres } from '@/lib/db';
import { usingBlob } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics. Never exposes values, only whether each backend is
 * configured and whether the database answers a trivial query.
 *
 *   { ok: true, database: "reachable", postgres: true, blob: true, ... }
 */
export async function GET() {
  const config = {
    postgres: usingPostgres,
    blob: usingBlob,
    adminBootstrap: Boolean(process.env.ADMIN_USERNAME && (process.env.ADMIN_PASSWORD ?? '').length >= 10),
    platform: process.env.VERCEL ? 'vercel' : 'node',
  };

  try {
    await one('SELECT 1 AS ok');
    return Response.json(
      { ok: true, ...config, database: 'reachable' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        ...config,
        database: 'error',
        hint: usingPostgres
          ? 'Postgres is configured but the query failed. Check that the database is running and the URL is current.'
          : 'No Postgres configured, and this host has no writable disk. Add a Postgres database in the Vercel dashboard (Storage -> Postgres), then redeploy.',
        error: message.slice(0, 500),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
