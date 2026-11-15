/** @type {import('next').NextConfig} */
const nextConfig = {
  // The SQL schema is read at runtime by src/lib/db.ts, so make sure it ships
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
