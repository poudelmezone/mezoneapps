import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/admin');

  return (
    <main id="main" className="login-page">
      <div className="login-card">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span className="brand-text">MezoneApps</span>
        </Link>

        <h1>Admin sign in</h1>
        <p className="muted">Publish builds, edit listings and watch the download numbers.</p>

        <LoginForm />

        <p className="field-hint" style={{ marginTop: 22 }}>
          Sessions expire after 12 hours. Sign-in attempts are rate limited.
        </p>
      </div>
    </main>
  );
}
