import { listPublishedApps } from '@/lib/apps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/apps — public catalogue as JSON (handy for integrations). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = (url.searchParams.get('q') ?? '').toLowerCase();
  const category = url.searchParams.get('category');

  let apps = listPublishedApps();

  if (search) {
    apps = apps.filter(
      (app) =>
        app.name.toLowerCase().includes(search) ||
        app.short_description.toLowerCase().includes(search) ||
        app.category.toLowerCase().includes(search),
    );
  }
  if (category) {
    apps = apps.filter((app) => app.category.toLowerCase() === category.toLowerCase());
  }

  return Response.json(
    {
      count: apps.length,
      apps: apps.map((app) => ({
        id: app.id,
        slug: app.slug,
        name: app.name,
        shortDescription: app.short_description,
        category: app.category,
        version: app.latest?.version ?? null,
        size: app.latest?.file_size ?? null,
        downloads: app.downloads,
        releasedAt: app.released_at,
        icon: app.icon_media_id ? `/api/media/${app.icon_media_id}` : null,
        url: `/apps/${app.slug}`,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
