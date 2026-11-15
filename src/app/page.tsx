import AppExplorer from '@/components/AppExplorer';
import Hero from '@/components/Hero';
import Reveal from '@/components/Reveal';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { listCategories, listPublishedApps, platformStats } from '@/lib/apps';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    title: 'Checked on arrival',
    body: 'An upload is rejected unless it is a real Android package inside the size limit. Each accepted file is hashed with SHA-256 and stored outside the web root.',
  },
  {
    title: 'Every version kept',
    body: 'Old builds stay downloadable. Each release keeps its own version number, size, upload date and download count, all listed on the app page.',
  },
  {
    title: 'Live without a queue',
    body: 'Publishing is a button, not a review process. A build uploaded now is served from this domain immediately, including fixes pushed at 2am.',
  },
];

export default async function HomePage() {
  const apps = listPublishedApps();
  const categories = listCategories();
  const stats = platformStats();
  const preview = apps.slice(0, 3).map((app) => ({
    slug: app.slug,
    name: app.name,
    version: app.latest?.version ?? null,
    size: app.latest?.file_size ?? null,
  }));

  return (
    <>
      <SiteHeader />

      <main id="main">
        <Hero appCount={stats.apps} downloads={stats.downloads} releases={stats.releases} preview={preview} />

        <section className="section" id="apps">
          <div className="container">
            <div className="section-head">
              <p className="kicker">Catalogue</p>
              <h2>{apps.length === 0 ? 'No apps published yet' : `${apps.length} apps, every build available`}</h2>
              <p className="lede">
                Filter by category or search the descriptions. Each listing keeps its whole release history, so an old
                version is never a dead link.
              </p>
            </div>

            <AppExplorer apps={apps} categories={categories} />
          </div>
        </section>

        <section className="section" id="why">
          <div className="container section-split">
            <div className="section-aside">
              <p className="kicker">How distribution works</p>
              <h2>Three steps between a build and a phone.</h2>
              <p className="lede">
                No store review, no mirrors, no waiting. The same server that holds the file serves the download.
              </p>
            </div>

            <ol className="feature-list">
              {STEPS.map((step, index) => (
                <Reveal key={step.title} as="li" className="feature-item" delay={index * 60}>
                  <span className="feature-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="feature-body">
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
