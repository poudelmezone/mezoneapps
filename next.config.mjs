/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native or server-only packages must not be bundled by webpack/turbopack;
  // Vercel's Node runtime resolves them from node_modules at deploy time.
  serverExternalPackages: ['better-sqlite3', 'pg'],

  // The SQLite schema is read at runtime by src/lib/db.ts, so make sure it ships
  // with the server bundle in standalone deployments.
  outputFileTracingIncludes: {
    '/**': ['./db/schema.sql'],
  },

  poweredByHeader: false,
  experimental: {
    // APK uploads go through route handlers; this keeps server actions in sync
    // if you later migrate the admin forms to actions.
    serverActions: { bodySizeLimit: '120mb' },
  },
};

export default nextConfig;
