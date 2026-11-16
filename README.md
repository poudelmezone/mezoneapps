# MezoneApps

[![CI](https://github.com/poudelmezone/mezoneapps/actions/workflows/ci.yml/badge.svg)](https://github.com/poudelmezone/mezoneapps/actions/workflows/ci.yml)
[![Docker image](https://github.com/poudelmezone/mezoneapps/actions/workflows/docker.yml/badge.svg)](https://github.com/poudelmezone/mezoneapps/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A self-hosted APK distribution site: a public catalogue of Android builds with checksummed downloads, plus a private
admin panel for publishing them. One Node process, one SQLite file, one folder of uploads.

Built with Next.js 15 (App Router) and React 19. No CMS, no external storage, no analytics.

---

## Features

**Public site**

- Catalogue with search, category filters and sorting (newest, recently updated, most downloaded, A-Z).
- App page with full description, screenshots and lightbox, version history, SHA-256, file size and release dates.
- Every build stays downloadable, so old versions never become dead links.
- Download counters per build and per app, updated in a single transaction.
- Light and dark themes with a persisted, system-aware toggle.

**Admin panel** (`/admin`)

- Password login (bcrypt, cost 12), server-side sessions, CSRF protection, login rate limiting.
- Create, edit, publish, unpublish and delete apps.
- APK upload with extension, size and file-signature validation; stored outside the web root.
- Icons and up to 8 screenshots per app, validated by magic bytes.
- Upload additional builds to an existing app, delete old ones, manage screenshots.
- Dashboard with app count, total downloads, stored builds and disk usage.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript | Public site, admin panel and API in one deployable. Server Components read SQLite directly; Route Handlers stream files. |
| Database | SQLite (`better-sqlite3`, WAL) | One owner, one file, no server to operate. |
| Storage | Local disk outside the web root | APKs are unreachable by path; only the download route serves them. |
| Styling | Hand-written CSS with design tokens | No utility framework, no runtime CSS-in-JS; one file drives both themes. |
| Auth | bcrypt + opaque server-side sessions | No OAuth dependency for a single-operator panel. |

---

## Design system

- **Themes:** every colour is a custom property. `:root` holds the light set, `:root[data-theme="dark"]` the dark set,
  and a `prefers-color-scheme` block covers the no-JS case. Surfaces are warm tinted neutrals (`#f5f1e9` and
  `#17140f`) rather than pure white or black; the only accent is rust (`#a8431f` light, `#e08a5a` dark).
- **Contrast:** body text is about 15:1 (light) and 14:1 (dark); secondary text stays above 5:1 in both.
- **Type:** serif display stack (Iowan Old Style, Palatino, Georgia) for headings, humanist sans (Candara, Seravek,
  Segoe UI) for body and UI, mono for versions, sizes and hashes. All system fonts, nothing is fetched.
- **Toggle:** reads `localStorage['mezoneapps-theme']`, falls back to `prefers-color-scheme`, and is applied by a blocking
  script before the first paint, so there is no flash of the wrong theme.
- **Motion:** 180 ms colour and border transitions only. `prefers-reduced-motion` removes even those.

---

## Quick start

Requires Node 20.9 or newer (Node 22 LTS recommended).

```bash
npm install
cp .env.example .env      # set ADMIN_USERNAME / ADMIN_PASSWORD
npm run admin:create      # hashes the password, creates or resets the account
npm run seed:demo         # optional: six demo listings with placeholder APKs
npm run dev               # http://localhost:3000
```

Sign in at `/admin/login`.

### Run it in GitHub Codespaces

The app runs inside a Codespace, which is the quickest way to try it with nothing installed locally:

1. On the repo page: **Code → Codespaces → Create codespace on main**.
2. In the terminal: `npm install`, then `cp .env.example .env`, set the credentials, `npm run admin:create`, `npm run dev`.
3. Open the forwarded port 3000. Its visibility defaults to private; make it public in the **Ports** tab only if you want
   to share a temporary demo.

Codespace storage is temporary: treat it as a demo environment, not production.

---

## Configuration

Copy `.env.example` to `.env`. The app boots without any of these and falls back to the defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | none | Seeds the first account: used by `npm run admin:create`, and read by the server once to bootstrap an empty `users` table (production password is 10+ characters) |
| `POSTGRES_URL` (or `DATABASE_URL`) | none | Use Postgres instead of SQLite. The schema is created on the first query |
| `BLOB_READ_WRITE_TOKEN` | none | Use Vercel Blob instead of `DATA_DIR` for APKs and images |
| `MAX_APK_MB` | `100` | Upload ceiling, enforced server-side |
| `DATA_DIR` | `./storage` | Root for `apks/`, `media/` and `app.db` |
| `DATABASE_PATH` | `$DATA_DIR/app.db` | Point the database at another disk |
| `NEXT_PUBLIC_SITE_URL` | none | Canonical origin for metadata |

`.env` is git-ignored. Never commit it; in production pass these as real environment variables instead.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on :3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run admin:create` | Creates or resets the admin account (bcrypt, revokes sessions) |
| `npm run seed:demo` | Inserts six demo apps with placeholder APKs (idempotent) |

---

## Project structure

```
db/schema.sql                SQLite schema, applied idempotently on boot
scripts/create-admin.mjs     account CLI
scripts/seed-demo.mjs        optional demo data
storage/                     apks/  media/  app.db   (git-ignored, never web-served)

src/app/
  layout.tsx                 shell + theme bootstrap script
  template.tsx               page transition
  globals.css                design tokens + every component style
  page.tsx                   editorial hero, catalogue, how-it-works
  apps/[slug]/page.tsx       public app page (+ ScreenshotGallery)
  admin/login/               unguarded login route
  admin/(panel)/             guarded dashboard, apps/new, apps/[id]
  api/                       auth, apps, download, media, admin/*

src/components/
  Hero, SiteHeader, SiteFooter, ThemeToggle, Reveal, AppCard, AppExplorer, icons
  admin/ AppForm, AssetManager, RowActions, SignOutButton

src/lib/
  db.ts  auth.ts  apps.ts  uploads.ts  validation.ts  app-form.ts  rate-limit.ts
```

---

## API

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/apps?q=&category=` | public | Catalogue as JSON |
| `GET` | `/api/download/:releaseId` | public | Streams the APK, increments counters |
| `GET` | `/api/media/:id` | public | Icon and screenshot bytes |
| `POST` | `/api/auth/login` | public, rate limited | Session cookie + CSRF token |
| `POST` | `/api/auth/logout` | session + CSRF | Revokes the session |
| `POST` | `/api/admin/apps` | session + CSRF | Create app (multipart) |
| `PATCH`, `DELETE` | `/api/admin/apps/:id` | session + CSRF | Edit, delete |
| `POST` | `/api/admin/apps/:id/releases` | session + CSRF | Upload a build |
| `POST` | `/api/admin/apps/:id/screenshots` | session + CSRF | Add a screenshot |
| `DELETE` | `/api/admin/releases/:id`, `/api/admin/screenshots/:id` | session + CSRF | Remove an asset |

---

## Security model

- **Passwords:** bcrypt cost 12; unknown usernames are compared against a dummy hash so timing does not leak accounts.
- **Sessions:** 256-bit random id in an `httpOnly`, `SameSite=Lax`, `Secure`-in-production cookie, 12-hour TTL, revocable
  server-side. Logout and password reset delete the rows.
- **CSRF:** every mutating admin request needs a per-session token in `x-csrf-token`, and the `Origin` must match the `Host`.
- **Rate limiting:** 5 login attempts per 15 minutes per IP and username, stored in SQLite so restarts do not clear it.
- **Uploads:** `.apk` extension, `MAX_APK_MB` ceiling, ZIP header plus `AndroidManifest.xml` check; images by magic bytes
  only. Stored under UUID names with `0600` permissions outside `public/`.
- **Serving:** downloads are streamed by release id with `Content-Disposition: attachment` and `nosniff`; media responses
  are sandboxed with a `default-src 'none'` CSP.
- **SQL:** every statement is parameterised.
- **XSS:** React escapes output; descriptions pass through a tag-stripping sanitiser and are never rendered as HTML.

---

## Deployment

**GitHub is the source host, not the runtime.** Two things rule out GitHub Pages: the app needs a Node server for its API
routes and downloads, and it stores data. Static hosting can do neither.

On a host with no writable disk, set two environment variables and the app switches backends by itself:
`POSTGRES_URL` (or `DATABASE_URL`) moves data to Postgres, `BLOB_READ_WRITE_TOKEN` moves APKs and images to Vercel Blob.
Nothing else changes — the same code still runs locally on SQLite plus `DATA_DIR`.

**1. Vercel** (Postgres + Blob, no disk needed)

Import the repo in Vercel, then in the project dashboard:

1. **Storage → Postgres** (Neon). This creates the database and injects `POSTGRES_URL`.
2. **Storage → Blob**. This creates the bucket and injects `BLOB_READ_WRITE_TOKEN`.
3. **Settings → Environment Variables**: add `ADMIN_USERNAME`, `ADMIN_PASSWORD` (10+ characters) and, optionally,
   `MAX_APK_MB`. Apply them to Production and Preview.
4. **Deployments → Redeploy** so the running build picks the variables up.

Open `/admin/login`. On the first auth request the app creates the admin account from `ADMIN_USERNAME` / `ADMIN_PASSWORD`,
but only while the `users` table is empty — after that the environment values are inert and the login page is the only way
in. Rotate the password from the panel, not the environment.

How uploads work there: Vercel caps request bodies at 4.5 MB, so admin forms ask `/api/admin/blob-upload` for a signed
token and send the APK **straight from the browser to Blob**. The form then posts only the metadata. Downloads are counted
first and answered with a `302` to the Blob URL.

**2. Container, anywhere with a volume**

```bash
docker build -t mezoneapps .
docker run -d --name mezoneapps -p 3000:3000 \
  -v mezoneapps-data:/data \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='a-long-passphrase' \
  mezoneapps
docker exec mezoneapps node scripts/create-admin.mjs   # create the account inside the volume
```

The image is also published to GitHub Container Registry on every push to `main`:

```bash
docker run -d -p 3000:3000 -v mezoneapps-data:/data ghcr.io/poudelmezone/mezoneapps:main
```

**3. Fly.io** (real volumes, so SQLite is safe)

```bash
fly launch --no-deploy
fly volumes create data --size 3          # GB; APKs and the database live here
# fly.toml: [mounts] source = "data"  destination = "/data"
fly secrets set ADMIN_USERNAME=admin ADMIN_PASSWORD='...'
fly deploy
fly ssh console -C "node scripts/create-admin.mjs"
```

**4. VPS or home server**

```bash
npm ci && npm run build
NODE_ENV=production npm start   # behind nginx or Caddy with TLS
```

nginx needs `client_max_body_size` above `MAX_APK_MB`, and `storage/` must be on a real disk. Run it under systemd or pm2
so it restarts on reboot.

A host with an ephemeral filesystem and no Postgres or Blob store is the only real dead end: without `DATA_DIR` there is
nowhere to put SQLite or the APK files.

### Backups

When you self-host, the database and the APKs are both under `DATA_DIR`. Back them up together:

```bash
sqlite3 storage/app.db ".backup '/backups/app-$(date +%F).db'"
tar czf "/backups/apks-$(date +%F).tar.gz" storage/apks
```

### Health check

`GET /api/apps` returns `200` with a JSON catalogue, so use it for uptime checks and container health probes (the
Dockerfile already does).

---

## Dependency notes

`npm audit` reports zero vulnerabilities. Two `overrides` keep it that way: `postcss` is pinned to the patched 8.x that
Next 15 pulls in, and `zod` (transitive through `@vercel/blob`) to 4.6.6+, which fixes a memory-exhaustion advisory.
Both can be dropped once the upstream packages raise their own floors.

## License

MIT, see [LICENSE](LICENSE).
