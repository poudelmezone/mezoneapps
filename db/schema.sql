-- ===========================================================================
-- APKForge schema (SQLite dialect).
-- Applied idempotently on boot by src/lib/db.ts.
-- All timestamps are Unix epoch milliseconds (INTEGER).
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------- accounts -----------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

-- Server-side sessions: the cookie only carries an opaque random token.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- ------------------------------ media -------------------------------------
-- Icons and screenshots. The row is the handle the app exposes; the bytes live
-- in $DATA_DIR/media on disk and are streamed by /api/media/[id].
CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  stored_name   TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  width         INTEGER,
  height        INTEGER,
  created_at    INTEGER NOT NULL
);

-- ------------------------------- apps -------------------------------------
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
  released_at       INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_apps_published ON apps(published, released_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps(category);

-- ------------------------------ releases ----------------------------------
-- Every APK build ever uploaded. The newest row is the "current version".
CREATE TABLE IF NOT EXISTS releases (
  id         TEXT PRIMARY KEY,
  app_id     TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version    TEXT NOT NULL,
  changelog  TEXT NOT NULL DEFAULT '',
  file_name  TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  file_size  INTEGER NOT NULL,
  sha256     TEXT NOT NULL,
  downloads  INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_releases_app ON releases(app_id, created_at DESC);

-- ---------------------------- screenshots ----------------------------------
CREATE TABLE IF NOT EXISTS screenshots (
  id       TEXT PRIMARY KEY,
  app_id   TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_screenshots_app ON screenshots(app_id, position);

-- ---------------------------- rate limiting --------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  reset_at   INTEGER NOT NULL
);
