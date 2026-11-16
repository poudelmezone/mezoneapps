import Link from 'next/link';
import { formatBytes, formatCount } from '@/lib/format';
import HeroScene from './HeroScene';
import { IconArrowRight, IconDownload } from './icons';

type HeroApp = {
  slug: string;
  name: string;
  version: string | null;
  size: number | null;
};

type HeroProps = {
  appCount: number;
  downloads: number;
  releases: number;
  preview: HeroApp[];
};

export default function Hero({ appCount, downloads, releases, preview }: HeroProps) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="kicker">Android builds, published here</p>

          <h1 className="hero-display">
            Software, handed over <em>directly</em>.
          </h1>

          <p className="hero-lead">
            This is where the apps get published. Every APK is uploaded to this site, hashed on arrival, and served from
            this domain with its full version history attached.
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="#apps">
              <IconDownload size={17} />
              Browse the catalogue
            </Link>
            <Link className="link-arrow" href="#why">
              How distribution works
              <IconArrowRight size={15} />
            </Link>
          </div>
        </div>

        <div className="hero-side">
          <div className="hero-stage" aria-hidden="true">
            <HeroScene />
          </div>

          <div className="ledger">
            <div className="ledger-head">
              <span>Latest releases</span>
              <span>{formatCount(appCount)} listed</span>
            </div>

            {preview.length > 0 ? (
              <ol className="ledger-list">
                {preview.map((app, index) => (
                  <li key={app.slug}>
                    <Link className="ledger-row" href={`/apps/${app.slug}`}>
                      <span className="ledger-index" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="ledger-main">
                        <strong>{app.name}</strong>
                        <span>
                          v{app.version ?? '—'} · {formatBytes(app.size)}
                        </span>
                      </span>
                      <IconArrowRight size={15} />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ledger-empty">Nothing published yet.</p>
            )}
          </div>

          <dl className="hero-stats">
            <div className="stat">
              <dt className="stat-label">Apps</dt>
              <dd className="stat-value">{formatCount(appCount)}</dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Builds</dt>
              <dd className="stat-value">{formatCount(releases)}</dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Downloads</dt>
              <dd className="stat-value">{formatCount(downloads)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
