export type MediaRow = {
  id: string;
  stored_name: string;
  original_name: string;
  mime: string;
  size: number;
  created_at: number;
};

export type AppRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category: string;
  changelog: string;
  icon_media_id: string | null;
  featured: number;
  published: number;
  downloads: number;
  released_at: number | null;
  created_at: number;
  updated_at: number;
};

export type ReleaseRow = {
  id: string;
  app_id: string;
  version: string;
  changelog: string;
  file_name: string;
  stored_name: string;
  file_size: number;
  sha256: string;
  downloads: number;
  created_at: number;
};

export type ScreenshotRow = {
  id: string;
  app_id: string;
  media_id: string;
  position: number;
};

/** An app plus the data the public UI needs, ready to serialise to a client component. */
export type AppSummary = AppRow & {
  latest: Pick<ReleaseRow, 'id' | 'version' | 'file_size' | 'created_at' | 'downloads'> | null;
  releaseCount: number;
};

export type AppDetail = AppSummary & {
  releases: ReleaseRow[];
  screenshots: { id: string; mediaId: string }[];
};
