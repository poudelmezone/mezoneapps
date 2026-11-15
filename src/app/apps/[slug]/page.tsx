import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppIcon } from '@/components/AppCard';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import Reveal from '@/components/Reveal';
import { IconCalendar, IconDownload, IconShield } from '@/components/icons';
import { getAppBySlug } from '@/lib/apps';
import { formatBytes, formatCount, formatDate } from '@/lib/format';
import ScreenshotGallery from './ScreenshotGallery';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) return { title: 'App not found' };

  return {
    title: `${app.name} ${app.latest ? `v${app.latest.version}` : ''}`.trim(),
    description: app.short_description,
    openGraph: {
      title: app.name,
      description: app.short_description,
    },
  };
}

export default async function AppDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const app = getAppBySlug(slug);
  if (!app) notFound();

  const latest = app.latest;
  const latestHash = app.releases[0]?.sha256 ?? '';

  return (
    <>
      <SiteHeader />

      <main id="main">
        <section className="detail-hero">
          <div className="container">
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/#apps">Apps</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{app.name}</span>
            </nav>

            <div className="detail-head">
              <AppIcon app={app} size="lg" />

              <div>
                <h1 className="detail-title">{app.name}</h1>
                <p className="detail-sub">{app.short_description}</p>

                <div className="detail-chips">
                  <span className="pill pill-accent">{app.category}</span>
                  {latest ? <span className="pill">v{latest.version}</span> : null}
                  <span className="pill">{formatBytes(latest?.file_size ?? null)}</span>
                  <span className="pill">
                    <IconCalendar size={13} />
                    {formatDate(app.released_at ?? app.created_at)}
                  </span>
                  <span className="pill">{formatCount(app.downloads)} downloads</span>
                </div>
              </div>

              <div className="detail-action">
                {latest ? (
                  <>
                    <a className="download-btn" href={`/api/download/${latest.id}`}>
                      <IconDownload size={20} />
                      Download APK
                    </a>
                    <span className="download-meta">
                      v{latest.version} · {formatBytes(latest.file_size)} · Android package
                    </span>
                  </>
                ) : (
                  <span className="pill">No build published yet</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="container detail-body">
          <div>
            {app.screenshots.length > 0 ? (
              <Reveal>
                <h2 style={{ fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
                  Screenshots
                </h2>
                <ScreenshotGallery images={app.screenshots} />
              </Reveal>
            ) : null}

            <Reveal>
              <div className="prose">
                <h3 style={{ marginTop: 0 }}>About this app</h3>
                {(app.description || app.short_description).split(/\n{2,}/).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </Reveal>

            {app.changelog ? (
              <Reveal>
                <div className="prose" style={{ marginTop: 34 }}>
                  <h3>What&apos;s new in {latest ? `v${latest.version}` : 'the latest build'}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{app.changelog}</p>
                </div>
              </Reveal>
            ) : null}

            {app.releases.length > 0 ? (
              <Reveal>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    marginTop: 44,
                    marginBottom: 18,
                  }}
                >
                  Version history
                </h2>

                <div className="release-list">
                  {app.releases.map((release, index) => (
                    <article className="release-item" key={release.id}>
                      <div className="release-head">
                        <span className="release-version">v{release.version}</span>
                        {index === 0 ? <span className="pill pill-accent">latest</span> : null}
                        <span className="release-meta">
                          {formatDate(release.created_at)} · {formatBytes(release.file_size)} ·{' '}
                          {formatCount(release.downloads)} downloads
                        </span>
                      </div>
                      {(release.changelog || (index === 0 ? app.changelog : '')).trim() ? (
                        <p className="release-notes">{release.changelog || app.changelog}</p>
                      ) : (
                        <p className="release-notes muted">Maintenance build.</p>
                      )}
                      <div style={{ marginTop: 10 }}>
                        <a className="btn btn-sm" href={`/api/download/${release.id}`}>
                          <IconDownload size={14} />
                          Download {formatBytes(release.file_size)}
                        </a>
                      </div>
                    </article>
                  ))}
                </div>

              </Reveal>
            ) : null}
          </div>

          <aside>
            <Reveal>
              <div className="side-card">
                <h3>Technical details</h3>
                <dl className="spec-list">
                  <div className="spec-row">
                    <dt>Version</dt>
                    <dd>{latest ? latest.version : '—'}</dd>
                  </div>
                  <div className="spec-row">
                    <dt>File size</dt>
                    <dd>{formatBytes(latest?.file_size ?? null)}</dd>
                  </div>
                  <div className="spec-row">
                    <dt>Released</dt>
                    <dd>{formatDate(app.released_at ?? latest?.created_at ?? app.created_at)}</dd>
                  </div>
                  <div className="spec-row">
                    <dt>Category</dt>
                    <dd>{app.category}</dd>
                  </div>
                  <div className="spec-row">
                    <dt>Total downloads</dt>
                    <dd>{formatCount(app.downloads)}</dd>
                  </div>
                  <div className="spec-row">
                    <dt>Builds available</dt>
                    <dd>{app.releases.length}</dd>
                  </div>
                </dl>

                {latest ? (
                  <div style={{ marginTop: 18 }}>
                    <p className="field-hint" style={{ marginBottom: 8 }}>
                      <IconShield size={13} /> SHA-256
                    </p>
                    <code
                      style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        wordBreak: 'break-all',
                        color: 'var(--muted)',
                        fontFamily: 'var(--font-mono)',
                        lineHeight: 1.5,
                      }}
                    >
                      {latestHash}
                    </code>
                  </div>
                ) : null}
              </div>
            </Reveal>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
