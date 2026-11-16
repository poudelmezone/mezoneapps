import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppForm from '@/components/admin/AppForm';
import AssetManager from '@/components/admin/AssetManager';
import { requireAdmin } from '@/lib/auth';
import { getAppById } from '@/lib/apps';
import { usingBlob } from '@/lib/storage';
import { MAX_APK_BYTES } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditAppPage({ params }: Props) {
  const session = await requireAdmin();
  const { id } = await params;
  const app = await getAppById(id);

  if (!app) notFound();

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>{app.name}</h1>
          <p className="muted">
            <span className={`status-chip ${app.published ? 'live' : 'draft'}`}>
              {app.published ? 'Live' : 'Draft'}
            </span>{' '}
            · /{app.slug}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/apps/${app.slug}`} className="btn btn-sm" target="_blank">
            View public page ↗
          </Link>
          <Link href="/admin" className="btn btn-sm btn-ghost">
            Back
          </Link>
        </div>
      </div>

      <AppForm
        csrf={session.csrfToken}
        mode="edit"
        app={app}
        maxApkMb={Math.round(MAX_APK_BYTES / 1024 / 1024)}
        uploadMode={usingBlob ? 'blob' : 'server'}
      />

      <AssetManager
        appId={app.id}
        csrf={session.csrfToken}
        releases={app.releases}
        screenshots={app.screenshots}
        maxApkMb={Math.round(MAX_APK_BYTES / 1024 / 1024)}
        uploadMode={usingBlob ? 'blob' : 'server'}
      />
    </>
  );
}
