-- ===========================================================================
-- MezoneApps schema (PostgreSQL dialect).
-- Mirrors db/schema.sql column-for-column so the query layer is portable.
-- Timestamps stay Unix epoch milliseconds and are stored as BIGINT.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    BIGINT NOT NULL,
  last_login_at BIGINT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  stored_name   TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size          BIGINT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'Other',
  changelog         TEXT NOT NULL DEFAULT '',
  icon_media_id     TEXT REFERENCES media(id) ON DELETE SET NULL,
  featured          INTEGER NOT NULL DEFAULT 0,
  published         INTEGER NOT NULL DEFAULT 0,
  downloads         INTEGER NOT NULL DEFAULT 0,
  released_at       BIGINT,
  created_at        BIGINT NOT NULL,
  updated_at        BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_apps_published ON apps(published, released_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps(category);

CREATE TABLE IF NOT EXISTS releases (
  id          TEXT PRIMARY KEY,
  app_id      TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,
  changelog   TEXT NOT NULL DEFAULT '',
  file_name   TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  file_size   BIGINT NOT NULL,
  sha256      TEXT NOT NULL,
  downloads   INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_releases_app ON releases(app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS screenshots (
  id       TEXT PRIMARY KEY,
  app_id   TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_screenshots_app ON screenshots(app_id, position);

CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);
