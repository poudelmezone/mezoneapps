import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="not-found">
        <div>
          <h1>404</h1>
          <p className="lede" style={{ margin: '18px auto 26px' }}>
            That page, build or app could not be found. It may have been unpublished.
          </p>
          <Link className="btn btn-primary" href="/">
            Back to the catalogue
          </Link>
        </div>
      </main>
    </>
  );
}
