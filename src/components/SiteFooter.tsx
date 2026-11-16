import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                A
              </span>
              <span className="brand-text">MezoneApps</span>
            </Link>
            <p>Signed builds, published by the developer. No trackers, no redirects, no third-party mirrors.</p>
          </div>

          <div className="footer-links">
            <Link href="/#apps">All apps</Link>
            <Link href="/#why">Why direct</Link>
            <Link href="/api/apps">Catalogue API</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MezoneApps</span>
          <span>APKs are served with their SHA-256 checksum for verification.</span>
        </div>
      </div>
    </footer>
  );
}
