#!/usr/bin/env node
/**
 * Optional: seeds a handful of demo listings so you can see the design working.
 *
 *   npm run seed:demo
 *
 * Each demo app gets a tiny placeholder .apk (a valid ZIP that contains an
 * AndroidManifest.xml, so it passes upload validation) — it is NOT installable.
 * Delete these once you start publishing real builds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import Database from 'better-sqlite3';

try {
  process.loadEnvFile?.('.env');
} catch {
  /* ignore */
}

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'storage'));
const apkDir = path.join(dataDir, 'apks');
fs.mkdirSync(apkDir, { recursive: true });

const db = new Database(path.resolve(process.env.DATABASE_PATH || path.join(dataDir, 'app.db')));
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));

// --- minimal ZIP writer (stored entries, no compression) ---------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuf, data);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, end]);
}

// --- demo data --------------------------------------------------------------
const DEMO = [
  {
    name: 'Nebula Notes',
    slug: 'nebula-notes',
    category: 'Productivity',
    version: '3.2.0',
    short: 'Offline-first notes with markdown, backlinks and end-to-end sync.',
    description:
      'Nebula Notes is a calm place to think. Write in markdown, link notes together, and search everything instantly whether you are online or not.\n\nEverything is stored locally by default and encrypted at rest. Sync is optional and end-to-end encrypted, so your notes never sit on someone else\'s server in the clear.',
    changelog: '- New graph view\n- Faster full-text search\n- Fixed a crash when pasting huge tables',
  },
  {
    name: 'Quartz Timer',
    slug: 'quartz-timer',
    category: 'Tools',
    version: '1.4.2',
    short: 'A focus timer that survives reboots, with widgets and shortcuts.',
    description:
      'Quartz is a no-nonsense focus timer. Set an interval, and it keeps counting even if the phone reboots mid-session.\n\nIncludes home-screen widgets, quick settings tiles and deep links for automation apps.',
    changelog: '- Added a 90/20 interval preset\n- Widgets now update instantly',
  },
  {
    name: 'Verdant',
    slug: 'verdant',
    category: 'Health',
    version: '0.9.1',
    short: 'Track plant care schedules without the subscription.',
    description:
      'Verdant keeps a simple list of your plants and tells you when to water, feed and repot them.\n\nNo accounts, no ads, no telemetry. Your garden stays on your device.',
    changelog: '- Seasonal watering adjustments\n- Export and import your garden as JSON',
  },
  {
    name: 'Arcade Drift',
    slug: 'arcade-drift',
    category: 'Games',
    version: '2.0.0',
    short: 'A neon drift racer with 60fps physics and gamepad support.',
    description:
      'Slide through rain-slicked neon streets in a physics-driven drift racer. Twelve tracks, four cars, and a ghost of your best lap on every level.\n\nSupports Bluetooth controllers and runs at 60fps on mid-range hardware.',
    changelog: '- Two new night tracks\n- Controller remapping\n- Reduced battery usage',
  },
  {
    name: 'Signal Finder',
    slug: 'signal-finder',
    category: 'Tools',
    version: '1.0.3',
    short: 'Find the best spot for your router with a live signal heatmap.',
    description:
      'Walk around your home and Signal Finder paints a heatmap of Wi-Fi and cellular strength, so you can put the router where it actually belongs.',
    changelog: '- First public release',
  },
  {
    name: 'Papercast',
    slug: 'papercast',
    category: 'Media',
    version: '4.1.0',
    short: 'Turn any article into a clean, offline reading queue.',
    description:
      'Papercast strips the ads, sidebars and cookie banners from articles and keeps the words. Queue links, read them offline, and keep a searchable archive.',
    changelog: '- Text-to-speech playback\n- Improved image handling in dark mode',
  },
];

const APK_MANIFEST =
  '<?xml version="1.0" encoding="utf-8"?><manifest package="com.example.demo"><application/></manifest>';

let created = 0;

const insertApp = db.prepare(
  `INSERT INTO apps (id, slug, name, short_description, description, category, changelog,
     icon_media_id, featured, published, downloads, released_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?, ?, ?)`,
);
const insertRelease = db.prepare(
  `INSERT INTO releases (id, app_id, version, changelog, file_name, stored_name, file_size, sha256, downloads, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

for (const [index, app] of DEMO.entries()) {
  const exists = db.prepare('SELECT id FROM apps WHERE slug = ?').get(app.slug);
  if (exists) continue;

  const apk = buildZip({
    'AndroidManifest.xml': APK_MANIFEST,
    'META-INF/demo.txt': `Placeholder build for ${app.name} v${app.version}.\n`,
  });

  const storedName = `${randomUUID()}.apk`;
  fs.writeFileSync(path.join(apkDir, storedName), apk, { mode: 0o600 });

  const appId = randomUUID();
  const releasedAt = Date.now() - index * 1000 * 60 * 60 * 24 * 9;

  insertApp.run(
    appId,
    app.slug,
    app.name,
    app.short,
    app.description,
    app.category,
    app.changelog,
    index === 0 ? 1 : 0,
    Math.floor(Math.random() * 400) + 20,
    releasedAt,
    releasedAt,
    releasedAt,
  );

  insertRelease.run(
    randomUUID(),
    appId,
    app.version,
    app.changelog,
    `${app.slug}-${app.version}.apk`,
    storedName,
    apk.length,
    createHash('sha256').update(apk).digest('hex'),
    Math.floor(Math.random() * 300) + 10,
    releasedAt,
  );

  created += 1;
}

console.log(created ? `Seeded ${created} demo apps.` : 'Demo apps already exist — nothing to do.');
db.close();
