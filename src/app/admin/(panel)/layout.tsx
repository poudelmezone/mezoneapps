import type { Metadata } from 'next';
import Link from 'next/link';
import SignOutButton from '@/components/admin/SignOutButton';
import ThemeToggle from '@/components/ThemeToggle';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side guard: nothing under /admin renders without a valid session.
  const session = await requireAdmin();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="container admin-topbar-inner">
          <Link href="/admin" className="brand">
            <span className="brand-mark" aria-hidden="true">
              A
            </span>
            <span className="brand-text">APKForge</span>
          </Link>

          <nav className="admin-nav" aria-label="Admin">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/apps/new">New app</Link>
            <Link href="/" target="_blank">
              View site ↗
            </Link>
          </nav>

          <div className="admin-user">
            <span>Signed in as {session.username}</span>
            <ThemeToggle />
            <SignOutButton csrf={session.csrfToken} />
          </div>
        </div>
      </header>

      <main id="main" className="container admin-main">
        {children}
      </main>
    </div>
  );
}
