'use client';

import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-shell">
      <div className="container" style={{ maxWidth: 640, padding: '96px 24px' }}>
        <p className="eyebrow">Something broke</p>
        <h1 style={{ marginTop: 8 }}>This page could not load its data.</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          If you run this site, open <code>/api/health</code> — it names the backend that is misconfigured. On Vercel the
          usual cause is a missing database: the server has no writable disk, so <code>POSTGRES_URL</code> must be set.
        </p>

        {error.digest ? (
          <p className="field-hint" style={{ marginTop: 18 }}>
            Error digest: {error.digest}
          </p>
        ) : null}

        <div className="form-actions" style={{ marginTop: 28, borderTop: 0, paddingTop: 0 }}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <Link className="btn btn-ghost" href="/">
            Back to the catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
