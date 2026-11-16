import fs from 'node:fs';
import path from 'node:path';
import { POSTGRES_SCHEMA } from './schema-pg';

/**
 * One query interface over two engines:
 *
 *  - PostgreSQL when POSTGRES_URL / DATABASE_URL is set (Vercel, Neon, Supabase…)
 *  - SQLite (`better-sqlite3`) otherwise, for local development and self-hosting
 *
 * Both branches expose the same async surface, so every caller awaits. SQL is
 * written with `?` placeholders and translated to `$n` for PostgreSQL. The two
 * schemas use identical column names and types (timestamps are epoch
 * milliseconds, booleans are 0/1 integers), so row shapes are interchangeable.
 */

const PG_URL = (process.env.POSTGRES_URL || process.env.DATABASE_URL || '').trim();
export const usingPostgres = /^postgres(ql)?:\/\//i.test(PG_URL);

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'storage'));
export const APK_DIR = path.join(DATA_DIR, 'apks');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');

export const now = () => Date.now();

/* ------------------------------- postgres -------------------------------- */

type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  connect: () => Promise<{
    query: (text: string, values?: unknown[]) => Promise<unknown>;
    release: () => void;
  }>;
};

let pgPool: PgPool | null = null;
let pgReady: Promise<void> | null = null;

async function getPool(): Promise<PgPool> {
  if (pgPool) return pgPool;

  const imported = (await import('pg')) as unknown as {
    default?: { Pool: new (config: unknown) => PgPool; types: { setTypeParser: (id: number, fn: (v: string) => unknown) => void } };
    Pool?: new (config: unknown) => PgPool;
    types?: { setTypeParser: (id: number, fn: (v: string) => unknown) => void };
  };
  const lib = imported.default ?? (imported as { Pool: new (config: unknown) => PgPool; types: { setTypeParser: (id: number, fn: (v: string) => unknown) => void } });

  // BIGINT columns hold epoch milliseconds; return them as numbers.
  lib.types.setTypeParser(20, (value: string) => Number(value));

  pgPool = new lib.Pool({
    connectionString: PG_URL,
    max: 4,
    ssl: /sslmode=require/i.test(PG_URL) ? { rejectUnauthorized: false } : undefined,
  });

  return pgPool;
}

async function ensurePostgres(): Promise<PgPool> {
  const pool = await getPool();
  if (!pgReady) {
    pgReady = pool.query(POSTGRES_SCHEMA).then(() => undefined);
  }
  await pgReady;
  return pool;
}

/** `?` → `$1`, `$2`, … (no `?` appears inside our string literals). */
function toPg(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  let index = 0;
  return { text: sql.replace(/\?/g, () => `$${(index += 1)}`), values: params };
}

/* -------------------------------- sqlite --------------------------------- */

type SqliteDb = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => Record<string, unknown>[];
    run: (...params: unknown[]) => unknown;
  };
  exec: (sql: string) => void;
  pragma: (sql: string) => void;
  transaction: (fn: () => void) => () => void;
};

let sqlite: SqliteDb | null = null;

async function getSqlite(): Promise<SqliteDb> {
  if (sqlite) return sqlite;

  const holder = globalThis as unknown as { __mezoneappsDb?: SqliteDb };
  if (holder.__mezoneappsDb) {
    sqlite = holder.__mezoneappsDb;
    return sqlite;
  }

  for (const dir of [DATA_DIR, APK_DIR, MEDIA_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const file = path.resolve(process.env.DATABASE_PATH || path.join(DATA_DIR, 'app.db'));
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const { default: Database } = (await import('better-sqlite3')) as unknown as {
    default: new (file: string) => SqliteDb;
  };

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));

  sqlite = db;
  holder.__mezoneappsDb = db;
  return db;
}

/* ------------------------------ public API ------------------------------- */

export async function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (usingPostgres) {
    const pool = await ensurePostgres();
    const result = await pool.query(toPg(sql, params).text, toPg(sql, params).values);
    return result.rows as T[];
  }
  const db = await getSqlite();
  return db.prepare(sql).all(...params) as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

export async function run(sql: string, params: unknown[] = []): Promise<void> {
  if (usingPostgres) {
    const pool = await ensurePostgres();
    const query = toPg(sql, params);
    await pool.query(query.text, query.values);
    return;
  }
  const db = await getSqlite();
  db.prepare(sql).run(...params);
}

/** Executes several statements atomically (used for download counters). */
export async function runMany(statements: { sql: string; params?: unknown[] }[]): Promise<void> {
  if (usingPostgres) {
    const pool = await ensurePostgres();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const statement of statements) {
        const query = toPg(statement.sql, statement.params ?? []);
        await client.query(query.text, query.values);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  const db = await getSqlite();
  const tx = db.transaction(() => {
    for (const statement of statements) {
      db.prepare(statement.sql).run(...(statement.params ?? []));
    }
  });
  tx();
}
