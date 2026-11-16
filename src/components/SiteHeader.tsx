import Link from 'next/link';
import BrandMark from './BrandMark';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="MezoneApps home">
          <BrandMark />
          <span className="brand-text">MezoneApps</span>
        </Link>

        <nav className="nav" aria-label="Primary">
          <Link className="nav-link" href="/#apps">
            Apps
          </Link>
          <Link className="nav-link" href="/#why">
            How it works
          </Link>
          <Link className="nav-link" href="/api/apps">
            API
          </Link>
        </nav>

        <div className="header-cta">
          <ThemeToggle />
          <Link href="/#apps" className="btn btn-primary btn-sm">
            Browse apps
          </Link>
        </div>
      </div>
    </header>
  );
}
