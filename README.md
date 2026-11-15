# APKForge

A production-ready APK distribution site: a public catalogue of Android apps with
secure downloads, plus a private admin panel for publishing builds.

> Sections: [1 Stack](#1-tech-stack-and-rationale) · [2 Structure](#2-project-structure) ·
> [3 Schema](#3-database-schema) · [4 Backend](#4-backend-code) · [5 Frontend](#5-frontend-code) ·
> [6 Admin](#6-admin-panel) · [7 Security](#7-security-checklist) · [8 Setup & deploy](#8-setup-and-deployment)

---

## 1. Tech stack and rationale

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | One codebase for the public site, the admin panel and the API. Server Components read SQLite directly (no API hop for page data), Route Handlers give real HTTP endpoints for uploads/downloads. Streaming responses make it trivial to serve a 100 MB APK without buffering it into memory. |
| Styling | **Hand-written CSS design system** (`src/app/globals.css`) | Zero runtime cost, full control over the 3D transforms, and a single place for the dark palette, spacing scale, and the `prefers-reduced-motion` overrides. No build-time framework to fight with. |
| Animations | **CSS 3D transforms + IntersectionObserver + a little pointer-driven JS** | The brief asked for bold depth. CSS `perspective`/`rotate3d`/`translateZ` plus a moving glare gives the tilt effect at 60fps on the compositor — no Three.js bundle (150 KB+) and no GSAP licence for effects that CSS does natively. Reduced-motion users get a completely static page. |
| Database | **SQLite via `better-sqlite3`** | A single-file database is the right size for one owner and a few thousand downloads: no server to run, synchronous API (fast, no connection pool), WAL mode for concurrent reads while the admin writes. The schema is portable: every statement is ANSI-ish SQL and `src/lib/db.ts` is the only place that opens a connection, so swapping in `pg` later means changing that file plus the `$n` placeholders. |
| File storage | **Local disk outside the web root** (`storage/apks`, `storage/media`) | The requirement is explicit: APKs must not be reachable by path. Files are written with `0o600`, named by UUID, and only ever streamed by `/api/download/[releaseId]` and `/api/media/[id]`. On a PaaS with an ephemeral disk, swap those two route handlers for an S3/R2 client — the rest of the code is unchanged. |
| Auth | **bcrypt (cost 12) + opaque server-side sessions** | One admin account, no OAuth needed. Passwords are hashed, the cookie carries only a random 256-bit token, and the session row (with its CSRF token) lives in the database, so revocation is a `DELETE`. |

**Deliberate omissions:** no ORM (the schema is ~90 lines of SQL and queries are hand-written and parameterised), no UI component library (it would fight the custom design), no Testcontainers/Playwright (out of scope for this deliverable).

---

## 2. Project structure

```
.
├─ db/
│  └─ schema.sql                 # idempotent schema, applied on boot
├─ scripts/
│  ├─ create-admin.mjs           # npm run admin:create
│  └─ seed-demo.mjs              # npm run seed:demo  (optional demo data)
├─ storage/                      # NOT web-served, git-ignored
│  ├─ apks/<uuid>.apk            # 0600, streamed only by /api/download
│  ├─ media/<uuid>.<ext>         # icons + screenshots
│  └─ app.db                     # SQLite (WAL)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx              # <html>, fonts, skip-link
│  │  ├─ template.tsx            # page-transition wrapper (runs on every route)
│  │  ├─ globals.css             # the whole design system
│  │  ├─ page.tsx                # homepage: hero + catalogue + features
│  │  ├─ not-found.tsx
│  │  ├─ apps/[slug]/page.tsx    # public app detail page
│  │  ├─ apps/[slug]/ScreenshotGallery.tsx
│  │  ├─ admin/
│  │  │  ├─ login/page.tsx       # public login route (outside the guard)
│  │  │  ├─ login/LoginForm.tsx
│  │  │  └─ (panel)/
│  │  │     ├─ layout.tsx        # requireAdmin() guard + top bar
│  │  │     ├─ page.tsx          # dashboard: stats + table of all apps
│  │  │     ├─ apps/new/page.tsx
│  │  │     └─ apps/[id]/page.tsx
│  │  └─ api/
│  │     ├─ auth/login/route.ts
│  │     ├─ auth/logout/route.ts
│  │     ├─ apps/route.ts                        # public JSON catalogue
│  │     ├─ download/[releaseId]/route.ts        # counted APK download
│  │     ├─ media/[id]/route.ts                  # icons/screenshots
│  │     └─ admin/
│  │        ├─ apps/route.ts                     # POST create
│  │        ├─ apps/[id]/route.ts                # PATCH / DELETE
│  │        ├─ apps/[id]/releases/route.ts       # POST upload APK
│  │        ├─ apps/[id]/screenshots/route.ts    # POST upload screenshot
│  │        ├─ releases/[id]/route.ts            # DELETE
│  │        └─ screenshots/[id]/route.ts         # DELETE
│  ├─ components/
│  │  ├─ Hero.tsx  TiltCard.tsx  Reveal.tsx      # the 3D/animation layer
│  │  ├─ AppCard.tsx  AppExplorer.tsx            # card + search/filter/sort
│  │  ├─ SiteHeader.tsx  SiteFooter.tsx  icons.tsx
│  │  └─ admin/ AppForm.tsx  AssetManager.tsx  RowActions.tsx  SignOutButton.tsx
│  └─ lib/
│     ├─ db.ts          # connection, pragmas, paths
│     ├─ auth.ts        # bcrypt, sessions, CSRF, origin checks
│     ├─ apps.ts        # all app/release/screenshot queries
│     ├─ uploads.ts     # magic-byte validation + file writing
│     ├─ validation.ts  # sanitisers + ValidationError
│     ├─ app-form.ts    # shared create/update form parser
│     ├─ rate-limit.ts  # SQLite fixed-window limiter
│     ├─ http.ts  format.ts  types.ts  categories.ts
├─ .env.example
├─ next.config.mjs
└─ package.json
```

---

## 3. Database schema

Full file: [`db/schema.sql`](db/schema.sql). Applied on every boot with
`CREATE TABLE IF NOT EXISTS`, so it doubles as the migration for a fresh install.

```sql
users(id PK, username UNIQUE, password_hash, created_at, last_login_at)

sessions(id PK,                       -- random 32-byte token (also the cookie value)
         user_id → users.id ON DELETE CASCADE,
         csrf_token,                  -- per-session CSRF secret
         expires_at, created_at, user_agent)

media(id PK, stored_name, original_name, mime, size, width, height, created_at)

apps(id PK, slug UNIQUE, name, short_description, description, category,
     changelog,                       -- "what's new" in the current version
     icon_media_id → media.id, featured, published, downloads,
     released_at, created_at, updated_at)

releases(id PK, app_id → apps.id ON DELETE CASCADE, version, changelog,
         file_name, stored_name, file_size, sha256, downloads, created_at)

screenshots(id PK, app_id → apps.id ON DELETE CASCADE,
            media_id → media.id ON DELETE CASCADE, position)

rate_limits(key PK, count, reset_at)  -- login throttling, survives restarts
```

Relationships: one app → many releases (newest is "current version"), many
screenshots, one icon. `apps.downloads` is a denormalised counter maintained in
the same transaction as `releases.downloads` so the grid never has to aggregate.

Indexes: `apps(published, released_at DESC)`, `apps(category)`,
`releases(app_id, created_at DESC)`, `sessions(expires_at)`,
`screenshots(app_id, position)`.

---

## 4. Backend code

### 4.1 Upload pipeline — `src/lib/uploads.ts`

```ts
const IMAGE_SIGNATURES = [
  { mime: 'image/png',  test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', test: (b) => b.subarray(0,4).toString('ascii') === 'RIFF' },
];

function looksLikeApk(buffer: Buffer): boolean {
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05);
  if (!isZip) return false;
  // The manifest name is stored uncompressed in the ZIP central directory.
  return buffer.includes(Buffer.from('AndroidManifest.xml', 'ascii'));
}

export async function storeApk(file: File) {
  if (!/\.apk$/i.test(file.name))  throw new ValidationError('Only .apk files are accepted.');
  if (file.size > MAX_APK_BYTES)   throw new ValidationError('APK is too large…');

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikeApk(buffer))       throw new ValidationError('Not a valid Android package.');

  const storedName = `${randomUUID()}.apk`;
  fs.writeFileSync(path.join(APK_DIR, storedName), buffer, { mode: 0o600 });

  return { fileName, storedName, fileSize: buffer.byteLength,
           sha256: createHash('sha256').update(buffer).digest('hex') };
}
```

Three independent checks: **extension** (cheap reject), **size** (configurable via
`MAX_APK_MB`), and **content** (ZIP magic bytes + `AndroidManifest.xml`). The
client-supplied MIME type is never trusted. Images get the same treatment — only
PNG/JPEG/WebP by signature, 5 MB cap, and the stored filename is derived from a
UUID plus an extension chosen server-side.

### 4.2 Download endpoint — `src/app/api/download/[releaseId]/route.ts`

```ts
export async function GET(_req, { params }) {
  const { releaseId } = await params;
  if (!/^[a-f0-9-]{8,64}$/i.test(releaseId)) return fail('Not found', 404);

  const release = registerDownload(releaseId);       // atomic counter bump
  if (!release) return fail('This build is no longer available.', 404);

  const filePath = resolveStoredApk(release.stored_name); // basename(), never the raw id
  if (!fs.existsSync(filePath)) return fail('The file is missing on the server.', 410);

  const stream = Readable.toWeb(fs.createReadStream(filePath));
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(release.file_size),
      'Content-Disposition': `attachment; filename="${release.file_name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
```

Path traversal is impossible: the URL only ever carries a release UUID, and the
filesystem path is reconstructed from the trusted `stored_name` column plus
`path.basename()`.

### 4.3 Key API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/apps?q=&category=` | public | JSON catalogue (60s cache) |
| `GET` | `/api/download/:releaseId` | public | Streams APK, increments counters |
| `GET` | `/api/media/:id` | public | Icons/screenshots, immutable cache |
| `POST` | `/api/auth/login` | public, rate limited | `{username,password}` → session cookie |
| `POST` | `/api/auth/logout` | session + CSRF | Destroys the session row |
| `POST` | `/api/admin/apps` | session + CSRF | `multipart/form-data`: fields, icon, screenshots, first APK |
| `PATCH` | `/api/admin/apps/:id` | session + CSRF | Full edit, or `{published}` / `{featured}` toggle |
| `DELETE` | `/api/admin/apps/:id` | session + CSRF | Removes app, releases, screenshots and files |
| `POST` | `/api/admin/apps/:id/releases` | session + CSRF | `multipart`: `apk`, `version`, `changelog` |
| `DELETE` | `/api/admin/releases/:id` | session + CSRF | Deletes build + file |
| `POST` | `/api/admin/apps/:id/screenshots` | session + CSRF | Adds one screenshot (max 8) |
| `DELETE` | `/api/admin/screenshots/:id` | session + CSRF | Deletes screenshot + file |

Every mutating admin handler starts with the same four lines:

```ts
const session = await getSession();
if (!session) return fail('Unauthorized.', 401);
if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);
```

### 4.4 Query layer — `src/lib/apps.ts` (excerpt)

```ts
export function registerDownload(releaseId: string) {
  const row = getRelease(releaseId);
  if (!row) return undefined;

  const tx = db.transaction(() => {
    db.prepare('UPDATE releases SET downloads = downloads + 1 WHERE id = ?').run(releaseId);
    db.prepare('UPDATE apps SET downloads = downloads + 1 WHERE id = ?').run(row.app_id);
  });
  tx();
  return row;
}
```

All SQL in the project is parameterised; there is no string interpolation of user
input anywhere.

---

## 5. Frontend code

### 5.1 The 3D tilt — `src/components/TiltCard.tsx`

Pointer position drives four CSS custom properties; the transform itself stays in
CSS so it runs on the compositor.

```tsx
const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
  if (event.pointerType === 'touch') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const rect = wrap.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;

  frame.current = requestAnimationFrame(() => {
    node.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
    node.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
    node.style.setProperty('--mx', `${px * 100}%`);   // glare follows the cursor
    node.style.setProperty('--my', `${py * 100}%`);
  });
};
```

```css
.tilt-wrap { perspective: 1000px; }
.tilt {
  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(var(--lift, 0px));
  transform-style: preserve-3d;
  transition: transform .35s cubic-bezier(.22,1,.36,1);
}
.tilt-wrap:hover .tilt { --lift: 18px; }
.tilt-glare {                        /* screen-blended light sweep */
  background: radial-gradient(420px circle at var(--mx,50%) var(--my,50%),
              rgba(139,92,246,.22), transparent 65%);
}
.app-icon   { transform: translateZ(28px); }   /* children float above the card */
.app-name   { transform: translateZ(18px); }
```

### 5.2 The hero scene — `src/components/Hero.tsx`

A CSS-only 3D scene: a phone frame, two dashed orbit rings, and three floating
stat tiles at different `translateZ` depths, all inside a container with
`perspective: 1400px`. A single `pointermove` listener on `window` (throttled with
`requestAnimationFrame`) nudges `--scene-ry` / `--scene-rx`, so the whole assembly
tilts in parallax.

```css
.scene-inner {
  transform-style: preserve-3d;
  transform: rotateX(var(--scene-rx, 4deg)) rotateY(var(--scene-ry, -12deg));
  transition: transform .5s var(--ease);
}
.phone       { transform: translateZ(60px);  animation: floatY 7s ease-in-out infinite; }
.tile-a      { transform: translateZ(140px); animation: floatY 6s ease-in-out infinite; }
.tile-b      { transform: translateZ(180px); animation: floatY 8s ease-in-out infinite reverse; }
```

### 5.3 Scroll reveals — `src/components/Reveal.tsx`

One shared `IntersectionObserver` per element, unobserved after firing, with a
`transition-delay` prop for stagger. Reduced-motion users are marked visible
immediately.

### 5.4 Search, filter and sort — `src/components/AppExplorer.tsx`

Client-side over the serialised catalogue (a few hundred apps at most): free-text
search across name/short description/full description/category, category chips as
`aria-pressed` toggle buttons, and four sort modes (newest, recently updated, most
downloaded, A→Z). An `aria-live` counter announces the result count as you type.

### 5.5 Reduced motion & accessibility

* `@media (prefers-reduced-motion: reduce)` collapses every animation/transition
  to `0.001ms`, disables `scroll-behavior: smooth`, and neutralises the tilt
  transforms — the page is fully static but complete.
* Skip link, `<main id="main">`, one `<h1>` per page, labelled form controls,
  `aria-pressed` filter chips, `aria-live` result counts, focus-visible outlines
  in cyan, and body text at ~12:1 contrast against the near-black background
  (`#f4f5fb` on `#05060b`); muted text stays above 6:1.
* The lightbox is a `role="dialog"` with `aria-modal`, Escape to close, arrow keys
  to navigate, and body scroll locking.

---

## 6. Admin panel

Routes live under `/admin`, guarded by `requireAdmin()` in
`src/app/admin/(panel)/layout.tsx` — a **server-side** check, so no admin HTML is
ever streamed to a signed-out visitor.

### 6.1 Login

`POST /api/auth/login`:

1. `verifyOrigin()` rejects cross-site posts.
2. Fixed-window limiter: **5 attempts / 15 min per IP+username** (`rate_limits` table).
3. `bcrypt.compareSync` against the stored hash; unknown users are compared against
   a dummy hash so response timing does not leak account existence.
4. On success: a 256-bit random session id **and** a separate CSRF token are
   inserted into `sessions`, and the id goes into an `httpOnly`, `SameSite=Lax`,
   `Secure`-in-production cookie with a 12-hour lifetime.

### 6.2 Dashboard

`src/app/admin/(panel)/page.tsx` lists every app (published and draft) with
icon, slug, category, current version, size, download count, status chip and an
edit link, plus stat cards for apps / downloads / builds / storage used.

`RowActions` provides **Publish / Unpublish** (a `PATCH` that refuses to publish an
app with zero builds) and **Delete** with a confirmation dialog that spells out
that the APK files go too.

### 6.3 Create / edit

`src/components/admin/AppForm.tsx` posts `multipart/form-data` straight to the API
with the CSRF header. Creating an app can include its first APK, version, release
notes, icon and up to 8 screenshots in one request. Editing lets you replace the
icon, rewrite copy, toggle publication, upload new builds
(`AssetManager`), delete old builds, and add or remove screenshots.

Every field is re-validated on the server by `parseAppForm()` — the browser's
`required`/`maxLength` attributes are only a convenience.

---

## 7. Security checklist

| Risk | Mitigation | Where |
| --- | --- | --- |
| Password theft | bcrypt cost 12, never logged or returned | `lib/auth.ts` |
| Session hijacking | 256-bit opaque id, `httpOnly`, `SameSite=Lax`, `Secure` in prod, 12h TTL, server-side revocation | `lib/auth.ts` |
| Brute force | 5 attempts / 15 min per IP+username, `Retry-After` on 429, dummy-hash timing equalisation | `api/auth/login` |
| CSRF | Per-session token required in `x-csrf-token` on every mutating request + `Origin`/`Host` comparison + `SameSite` cookies | `verifyCsrf`, `verifyOrigin` |
| XSS | React escapes all output; descriptions pass through `stripMarkup()` which removes tags and `javascript:`; no `dangerouslySetInnerHTML` anywhere | `lib/validation.ts` |
| Malicious uploads | Extension + size + ZIP/`AndroidManifest.xml` signature for APKs; PNG/JPEG/WebP magic bytes for images; UUID filenames; never executable | `lib/uploads.ts` |
| Path traversal | Download/media URLs carry UUIDs only; paths rebuilt from DB + `path.basename()` | `api/download`, `api/media` |
| Direct file exposure | `storage/` is outside `public/` and git-ignored; APKs written `0o600` | `lib/db.ts` |
| Response splitting / sniffing | `Content-Disposition` filename sanitised; `X-Content-Type-Options: nosniff`; media served with `Content-Security-Policy: default-src 'none'; sandbox` | route handlers |
| SQL injection | Every query parameterised; no dynamic SQL from input | `lib/apps.ts` |
| Enumeration | Draft/unpublished apps 404 for the public; download/media ids are unguessable | `lib/apps.ts` |
| Unauthorised admin | Server-side `requireAdmin()` on the layout + auth check in every admin route handler | `admin/(panel)/layout.tsx` |
| Accidental publish without a build | API rejects `published=true` when the app has no release | `api/admin/apps` |
| Resource exhaustion | `MAX_APK_MB` cap, 8-screenshot cap, 5 MB image cap, 20 000-char description cap | `lib/uploads.ts`, `lib/validation.ts` |

**Operational hardening to add per deployment:** HTTPS everywhere (the `Secure`
cookie flag already assumes it), a reverse proxy with its own rate limits, nightly
`storage/` + `app.db` backups, and `npm audit`/Dependabot in CI.

---

## 8. Setup and deployment

### Local setup

```bash
npm install                # native better-sqlite3 prebuild is fetched/downloaded

cp .env.example .env       # then edit ADMIN_USERNAME / ADMIN_PASSWORD
npm run admin:create       # hashes the password, creates (or resets) the account
npm run seed:demo          # optional: 6 demo listings with placeholder APKs

npm run dev                # http://localhost:3000
```

Sign in at **/admin/login** with the credentials from `.env` (this repo's local
`.env` uses `admin` / `apkforge-dev-password` — change it before exposing the app).

Other scripts: `npm run build`, `npm start`, `npm run typecheck`,
`npm run seed:demo` (idempotent — skips existing slugs).

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | — | Read only by `npm run admin:create` |
| `MAX_APK_MB` | `100` | Upload hard cap, enforced server-side |
| `DATA_DIR` | `./storage` | Root for `apks/`, `media/`, `app.db` |
| `DATABASE_PATH` | `$DATA_DIR/app.db` | Override to point at another disk |
| `NEXT_PUBLIC_SITE_URL` | — | Canonical origin for metadata/OG tags |

### Deployment

**A VPS or home server (recommended, this is the design target).**

```bash
npm ci
npm run build
NODE_ENV=production npm start        # binds :3000
```

Put nginx/Caddy in front for TLS and a client-body limit above `MAX_APK_MB`:

```nginx
server {
  server_name apps.example.com;
  client_max_body_size 120M;          # > MAX_APK_MB

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Run it under systemd (`Restart=always`) or pm2. Keep `storage/` on a real disk —
it holds the database **and** every APK — and back it up:

```bash
# /etc/cron.daily/apkforge
sqlite3 /srv/apkforge/storage/app.db ".backup '/srv/backups/app-$(date +%F).db'"
tar czf "/srv/backups/apks-$(date +%F).tar.gz" /srv/apkforge/storage/apks
```

**Docker** (works anywhere with a persistent volume):

```dockerfile
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/package.json /app/next.config.mjs ./
COPY --from=build /app/db ./db
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
```

**Serverless (Vercel/Netlify) caveat:** these platforms have an ephemeral
filesystem and no persistent SQLite. To host there, move the database to
Postgres (`src/lib/db.ts` + the query layer are the only files to touch) and the
uploads to S3/R2 (`storeApk`/`storeImage` and the two streaming routes). Nothing
else in the app assumes local disk.

### First-run checklist

1. `npm run admin:create` with a long passphrase.
2. Sign in, create an app, upload an APK, publish it.
3. Hit the public page, click **Download APK**, confirm the counter increments.
4. Point `DATA_DIR` at backed-up storage and put the app behind HTTPS.
"# mezoneapps" 
