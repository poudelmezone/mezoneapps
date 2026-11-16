import Link from 'next/link';
import { AppIcon } from '@/components/AppCard';
import RowActions from '@/components/admin/RowActions';
import { IconArrowRight, IconDownload } from '@/components/icons';
import { requireAdmin } from '@/lib/auth';
import { listAllApps, platformStats } from '@/lib/apps';
import { formatBytes, formatCount, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await requireAdmin();
  const apps = await listAllApps();
  const stats = await platformStats();
  const published = apps.filter((app) => app.published).length;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Manage your catalogue, builds and download counters.</p>
        </div>
        <Link href="/admin/apps/new" className="btn btn-primary">
          + New app
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{formatCount(stats.apps)}</div>
          <div className="stat-label">Published apps</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCount(stats.downloads)}</div>
          <div className="stat-label">Total downloads</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCount(stats.releases)}</div>
          <div className="stat-label">APK builds stored</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatBytes(stats.bytes)}</div>
          <div className="stat-label">Storage in use</div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="admin-table">
          <caption className="sr-only">All apps, published and draft</caption>
          <thead>
            <tr>
              <th scope="col">App</th>
              <th scope="col">Category</th>
              <th scope="col">Version</th>
              <th scope="col">Size</th>
              <th scope="col">Downloads</th>
              <th scope="col">Status</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 18px' }} className="muted">
                  No apps yet.{' '}
                  <Link href="/admin/apps/new" style={{ color: 'var(--mint)' }}>
                    Create your first one →
                  </Link>
                </td>
              </tr>
            ) : (
              apps.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div className="row-app">
                      <AppIcon app={app} />
                      <div>
                        <strong>{app.name}</strong>
                        <span>/{app.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td>{app.category}</td>
                  <td>{app.latest ? `v${app.latest.version}` : '—'}</td>
                  <td>{formatBytes(app.latest?.file_size ?? null)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <IconDownload size={13} />
                      {formatCount(app.downloads)}
                    </span>
                  </td>
                  <td>
                    <span className={`status-chip ${app.published ? 'live' : 'draft'}`}>
                      {app.published ? 'Live' : 'Draft'}
                    </span>
                    <div className="field-hint" style={{ marginTop: 4 }}>
                      {formatDate(app.updated_at)}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/apps/${app.id}`} className="btn btn-sm">
                        Edit <IconArrowRight size={13} />
                      </Link>
                    </div>
                    <RowActions appId={app.id} csrf={session.csrfToken} published={Boolean(app.published)} name={app.name} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="field-hint" style={{ marginTop: 18 }}>
        {apps.length - published} draft{apps.length - published === 1 ? '' : 's'} not visible to visitors. Uploads are
        validated server-side and stored outside the public web root.
      </p>
    </>
  );
}
