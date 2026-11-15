import { randomUUID } from 'node:crypto';
import { db, now } from './db';
import { deleteMedia, removeFile, resolveStoredApk } from './uploads';
import type { AppDetail, AppRow, AppSummary, ReleaseRow, ScreenshotRow } from './types';

type ReleaseLite = AppSummary['latest'];

function attachReleases(apps: AppRow[]): AppSummary[] {
  if (apps.length === 0) return [];

  const ids = apps.map((app) => app.id);
  const placeholders = ids.map(() => '?').join(',');
  const releases = db
    .prepare(`SELECT * FROM releases WHERE app_id IN (${placeholders}) ORDER BY created_at DESC`)
    .all(...ids) as ReleaseRow[];

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

export function listPublishedApps(): AppSummary[] {
  const apps = db
    .prepare(`SELECT * FROM apps WHERE published = 1 ORDER BY featured DESC, COALESCE(released_at, created_at) DESC`)
    .all() as AppRow[];
  return attachReleases(apps);
}

export function listAllApps(): AppSummary[] {
  const apps = db.prepare('SELECT * FROM apps ORDER BY created_at DESC').all() as AppRow[];
  return attachReleases(apps);
}

export function listCategories(): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT category FROM apps WHERE published = 1 ORDER BY category COLLATE NOCASE ASC`)
    .all() as { category: string }[];
  return rows.map((row) => row.category);
}

export function getAppBySlug(slug: string): AppDetail | null {
  const app = db.prepare('SELECT * FROM apps WHERE slug = ? AND published = 1').get(slug) as AppRow | undefined;
  if (!app) return null;
  return buildDetail(app);
}

export function getAppById(id: string): AppDetail | null {
  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined;
  if (!app) return null;
  return buildDetail(app);
}

function buildDetail(app: AppRow): AppDetail {
  const summary = attachReleases([app])[0]!;
  const releases = db
    .prepare('SELECT * FROM releases WHERE app_id = ? ORDER BY created_at DESC')
    .all(app.id) as ReleaseRow[];
  const shots = db
    .prepare('SELECT * FROM screenshots WHERE app_id = ? ORDER BY position ASC')
    .all(app.id) as ScreenshotRow[];

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

export function slugTaken(slug: string, exceptId?: string): boolean {
  const row = exceptId
    ? db.prepare('SELECT id FROM apps WHERE slug = ? AND id != ?').get(slug, exceptId)
    : db.prepare('SELECT id FROM apps WHERE slug = ?').get(slug);
  return Boolean(row);
}

export function createApp(input: AppInput): string {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(
    `INSERT INTO apps
       (id, slug, name, short_description, description, category, changelog, icon_media_id,
        featured, published, downloads, released_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
  ).run(
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
  );
  return id;
}

export function updateApp(id: string, input: AppInput): void {
  db.prepare(
    `UPDATE apps SET
       slug = ?, name = ?, short_description = ?, description = ?, category = ?, changelog = ?,
       icon_media_id = ?, featured = ?, published = ?, released_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
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
  );
}

export function deleteApp(id: string): void {
  const app = getAppById(id);
  if (!app) return;

  for (const release of app.releases) {
    removeFile(resolveStoredApk(release.stored_name));
  }
  for (const shot of app.screenshots) {
    deleteMedia(shot.mediaId);
  }
  deleteMedia(app.icon_media_id);

  db.prepare('DELETE FROM apps WHERE id = ?').run(id);
}

export function addRelease(input: {
  appId: string;
  version: string;
  changelog: string;
  fileName: string;
  storedName: string;
  fileSize: number;
  sha256: string;
}): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO releases (id, app_id, version, changelog, file_name, stored_name, file_size, sha256, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.appId,
    input.version,
    input.changelog,
    input.fileName,
    input.storedName,
    input.fileSize,
    input.sha256,
    now(),
  );
  db.prepare('UPDATE apps SET updated_at = ? WHERE id = ?').run(now(), input.appId);
  return id;
}

export function deleteRelease(id: string): void {
  const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(id) as ReleaseRow | undefined;
  if (!row) return;
  removeFile(resolveStoredApk(row.stored_name));
  db.prepare('DELETE FROM releases WHERE id = ?').run(id);
}

export function getRelease(id: string): ReleaseRow | undefined {
  return db.prepare('SELECT * FROM releases WHERE id = ?').get(id) as ReleaseRow | undefined;
}

export function addScreenshot(appId: string, mediaId: string): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM screenshots WHERE app_id = ?').get(appId) as { n: number };
  db.prepare('INSERT INTO screenshots (id, app_id, media_id, position) VALUES (?, ?, ?, ?)').run(
    randomUUID(),
    appId,
    mediaId,
    count.n,
  );
}

export function deleteScreenshot(id: string): void {
  const row = db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id) as ScreenshotRow | undefined;
  if (!row) return;
  deleteMedia(row.media_id);
  db.prepare('DELETE FROM screenshots WHERE id = ?').run(id);
}

/** Atomically record a download and return the release to stream. */
export function registerDownload(releaseId: string): ReleaseRow | undefined {
  const row = getRelease(releaseId);
  if (!row) return undefined;

  const tx = db.transaction(() => {
    db.prepare('UPDATE releases SET downloads = downloads + 1 WHERE id = ?').run(releaseId);
    db.prepare('UPDATE apps SET downloads = downloads + 1 WHERE id = ?').run(row.app_id);
  });
  tx();

  return row;
}

export function platformStats() {
  const apps = db.prepare('SELECT COUNT(*) AS n FROM apps WHERE published = 1').get() as { n: number };
  const downloads = db.prepare('SELECT COALESCE(SUM(downloads), 0) AS n FROM apps').get() as { n: number };
  const releases = db.prepare('SELECT COUNT(*) AS n FROM releases').get() as { n: number };
  const size = db.prepare('SELECT COALESCE(SUM(file_size), 0) AS n FROM releases').get() as { n: number };
  return { apps: apps.n, downloads: downloads.n, releases: releases.n, bytes: size.n };
}
