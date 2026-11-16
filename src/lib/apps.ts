import { randomUUID } from 'node:crypto';
import { all, now, one, run, runMany } from './db';
import { deleteStored } from './storage';
import type { AppDetail, AppRow, AppSummary, ReleaseRow, ScreenshotRow } from './types';

type ReleaseLite = AppSummary['latest'];

async function attachReleases(apps: AppRow[]): Promise<AppSummary[]> {
  if (apps.length === 0) return [];

  const ids = apps.map((app) => app.id);
  const placeholders = ids.map(() => '?').join(',');
  const releases = await all<ReleaseRow>(
    `SELECT * FROM releases WHERE app_id IN (${placeholders}) ORDER BY created_at DESC`,
    ids,
  );

  const byApp = new Map<string, ReleaseRow[]>();
  for (const release of releases) {
    const list = byApp.get(release.app_id) ?? [];
    list.push(release);
    byApp.set(release.app_id, list);
  }

  return apps.map((app) => {
    const list = byApp.get(app.id) ?? [];
    const latestRow = list[0];
    const latest: ReleaseLite = latestRow
      ? {
          id: latestRow.id,
          version: latestRow.version,
          file_size: latestRow.file_size,
          created_at: latestRow.created_at,
          downloads: latestRow.downloads,
        }
      : null;
    return { ...app, latest, releaseCount: list.length };
  });
}

export async function listPublishedApps(): Promise<AppSummary[]> {
  const apps = await all<AppRow>(
    `SELECT * FROM apps WHERE published = 1 ORDER BY featured DESC, COALESCE(released_at, created_at) DESC`,
  );
  return attachReleases(apps);
}

export async function listAllApps(): Promise<AppSummary[]> {
  const apps = await all<AppRow>('SELECT * FROM apps ORDER BY created_at DESC');
  return attachReleases(apps);
}

export async function listCategories(): Promise<string[]> {
  const rows = await all<{ category: string }>(
    `SELECT DISTINCT category FROM apps WHERE published = 1 ORDER BY category ASC`,
  );
  return rows.map((row) => row.category);
}

export async function getAppBySlug(slug: string): Promise<AppDetail | null> {
  const app = await one<AppRow>('SELECT * FROM apps WHERE slug = ? AND published = 1', [slug]);
  if (!app) return null;
  return buildDetail(app);
}

export async function getAppById(id: string): Promise<AppDetail | null> {
  const app = await one<AppRow>('SELECT * FROM apps WHERE id = ?', [id]);
  if (!app) return null;
  return buildDetail(app);
}

async function buildDetail(app: AppRow): Promise<AppDetail> {
  const summary = (await attachReleases([app]))[0]!;
  const releases = await all<ReleaseRow>('SELECT * FROM releases WHERE app_id = ? ORDER BY created_at DESC', [app.id]);
  const shots = await all<ScreenshotRow>('SELECT * FROM screenshots WHERE app_id = ? ORDER BY position ASC', [app.id]);

  return {
    ...summary,
    releases,
    screenshots: shots.map((row) => ({ id: row.id, mediaId: row.media_id })),
  };
}

export type AppInput = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  category: string;
  changelog: string;
  releasedAt: number | null;
  published: boolean;
  featured: boolean;
  iconMediaId: string | null;
};

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const row = exceptId
    ? await one('SELECT id FROM apps WHERE slug = ? AND id != ?', [slug, exceptId])
    : await one('SELECT id FROM apps WHERE slug = ?', [slug]);
  return Boolean(row);
}

export async function createApp(input: AppInput): Promise<string> {
  const id = randomUUID();
  const timestamp = now();
  await run(
    `INSERT INTO apps
       (id, slug, name, short_description, description, category, changelog, icon_media_id,
        featured, published, downloads, released_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      input.slug,
      input.name,
      input.shortDescription,
      input.description,
      input.category,
      input.changelog,
      input.iconMediaId,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
      input.releasedAt,
      timestamp,
      timestamp,
    ],
  );
  return id;
}

export async function updateApp(id: string, input: AppInput): Promise<void> {
  await run(
    `UPDATE apps SET
       slug = ?, name = ?, short_description = ?, description = ?, category = ?, changelog = ?,
       icon_media_id = ?, featured = ?, published = ?, released_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.slug,
      input.name,
      input.shortDescription,
      input.description,
      input.category,
      input.changelog,
      input.iconMediaId,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
      input.releasedAt,
      now(),
      id,
    ],
  );
}

export async function deleteApp(id: string): Promise<void> {
  const app = await getAppById(id);
  if (!app) return;

  for (const release of app.releases) {
    await deleteStored('apk', release.stored_name);
  }
  for (const shot of app.screenshots) {
    await deleteMedia(shot.mediaId);
  }
  await deleteMedia(app.icon_media_id);

  await run('DELETE FROM apps WHERE id = ?', [id]);
}

export async function addRelease(input: {
  appId: string;
  version: string;
  changelog: string;
  fileName: string;
  storedName: string;
  fileSize: number;
  sha256: string;
}): Promise<string> {
  const id = randomUUID();
  await run(
    `INSERT INTO releases (id, app_id, version, changelog, file_name, stored_name, file_size, sha256, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.appId, input.version, input.changelog, input.fileName, input.storedName, input.fileSize, input.sha256, now()],
  );
  await run('UPDATE apps SET updated_at = ? WHERE id = ?', [now(), input.appId]);
  return id;
}

export async function deleteRelease(id: string): Promise<void> {
  const row = await one<ReleaseRow>('SELECT * FROM releases WHERE id = ?', [id]);
  if (!row) return;
  await deleteStored('apk', row.stored_name);
  await run('DELETE FROM releases WHERE id = ?', [id]);
}

export async function getRelease(id: string): Promise<ReleaseRow | undefined> {
  return one<ReleaseRow>('SELECT * FROM releases WHERE id = ?', [id]);
}

export async function addScreenshot(appId: string, mediaId: string): Promise<void> {
  const count = await one<{ n: number }>('SELECT COUNT(*) AS n FROM screenshots WHERE app_id = ?', [appId]);
  await run('INSERT INTO screenshots (id, app_id, media_id, position) VALUES (?, ?, ?, ?)', [
    randomUUID(),
    appId,
    mediaId,
    Number(count?.n ?? 0),
  ]);
}

export async function deleteScreenshot(id: string): Promise<void> {
  const row = await one<ScreenshotRow>('SELECT * FROM screenshots WHERE id = ?', [id]);
  if (!row) return;
  await deleteMedia(row.media_id);
  await run('DELETE FROM screenshots WHERE id = ?', [id]);
}

export async function deleteMedia(id: string | null | undefined): Promise<void> {
  if (!id) return;
  const media = await one<{ stored_name: string }>('SELECT stored_name FROM media WHERE id = ?', [id]);
  if (media) await deleteStored('media', media.stored_name);
  await run('DELETE FROM media WHERE id = ?', [id]);
}

/** Atomically record a download and return the release to stream. */
export async function registerDownload(releaseId: string): Promise<ReleaseRow | undefined> {
  const row = await getRelease(releaseId);
  if (!row) return undefined;

  await runMany([
    { sql: 'UPDATE releases SET downloads = downloads + 1 WHERE id = ?', params: [releaseId] },
    { sql: 'UPDATE apps SET downloads = downloads + 1 WHERE id = ?', params: [row.app_id] },
  ]);

  return row;
}

export async function platformStats() {
  const apps = await one<{ n: number }>('SELECT COUNT(*) AS n FROM apps WHERE published = 1');
  const downloads = await one<{ n: number }>('SELECT COALESCE(SUM(downloads), 0) AS n FROM apps');
  const releases = await one<{ n: number }>('SELECT COUNT(*) AS n FROM releases');
  const size = await one<{ n: number }>('SELECT COALESCE(SUM(file_size), 0) AS n FROM releases');
  return {
    apps: Number(apps?.n ?? 0),
    downloads: Number(downloads?.n ?? 0),
    releases: Number(releases?.n ?? 0),
    bytes: Number(size?.n ?? 0),
  };
}
