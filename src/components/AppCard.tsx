import Link from 'next/link';
import { formatBytes, formatCount, initials } from '@/lib/format';
import type { AppSummary } from '@/lib/types';
import { IconDownload } from './icons';

export function AppIcon({ app, size = 'md' }: { app: AppSummary; size?: 'md' | 'lg' }) {
  return (
    <span className={size === 'md' ? 'app-icon' : 'detail-icon'} aria-hidden="true">
      {app.icon_media_id ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/media/${app.icon_media_id}`}
          alt=""
          width={size === 'md' ? 48 : 88}
          height={size === 'md' ? 48 : 88}
        />
      ) : (
        initials(app.name)
      )}
    </span>
  );
}

export default function AppCard({ app }: { app: AppSummary }) {
  return (
    <article className="app-card">
      <Link className="app-card-link" href={`/apps/${app.slug}`} aria-label={`Open ${app.name}`}>
        <div className="app-card-top">
          <AppIcon app={app} />
          <span className="app-category">{app.category}</span>
        </div>

        <h3 className="app-name">{app.name}</h3>
        <p className="app-desc">{app.short_description}</p>

        <div className="app-meta">
          <span className="app-meta-item">v{app.latest?.version ?? '—'}</span>
          <span className="app-meta-item">{formatBytes(app.latest?.file_size ?? null)}</span>
          <span className="app-meta-item app-meta-downloads">
            <IconDownload size={13} />
            {formatCount(app.downloads)}
          </span>
        </div>
      </Link>
    </article>
  );
}
