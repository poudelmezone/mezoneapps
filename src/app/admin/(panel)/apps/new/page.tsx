import AppForm from '@/components/admin/AppForm';
import { requireAdmin } from '@/lib/auth';
import { MAX_APK_BYTES } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export default async function NewAppPage() {
  const session = await requireAdmin();

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>New app</h1>
          <p className="muted">Create a listing and upload the first APK build.</p>
        </div>
      </div>

      <AppForm csrf={session.csrfToken} mode="create" maxApkMb={Math.round(MAX_APK_BYTES / 1024 / 1024)} />
    </>
  );
}
