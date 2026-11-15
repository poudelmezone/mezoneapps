import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="APKForge home">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span className="brand-text">APKForge</span>
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
