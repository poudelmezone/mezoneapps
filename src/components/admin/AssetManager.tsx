'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { IconTrash } from '@/components/icons';
import { formatBytes, formatCount, formatDate } from '@/lib/format';
import type { ReleaseRow } from '@/lib/types';

type Props = {
  appId: string;
  csrf: string;
  releases: ReleaseRow[];
  screenshots: { id: string; mediaId: string }[];
  maxApkMb: number;
};

export default function AssetManager({ appId, csrf, releases, screenshots, maxApkMb }: Props) {
  const router = useRouter();
  const releaseForm = useRef<HTMLFormElement>(null);
  const shotForm = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function request(url: string, method: string, body?: FormData) {
    const response = await fetch(url, {
      method,
      headers: { 'x-csrf-token': csrf },
      body,
    }).catch(() => null);

    if (!response || !response.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(data?.error ?? 'The request failed.');
      return false;
    }
    return true;
  }

  async function uploadRelease(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending('release');

    const ok = await request(`/api/admin/apps/${appId}/releases`, 'POST', new FormData(event.currentTarget));

    setPending(null);
    if (ok) {
      releaseForm.current?.reset();
      router.refresh();
    }
  }

  async function uploadScreenshot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending('screenshot');

    const ok = await request(`/api/admin/apps/${appId}/screenshots`, 'POST', new FormData(event.currentTarget));

    setPending(null);
    if (ok) {
      shotForm.current?.reset();
      router.refresh();
    }
  }

  async function removeRelease(id: string) {
    if (!window.confirm('Delete this build? The APK file is removed from disk.')) return;
    setPending(id);
    setError(null);
    if (await request(`/api/admin/releases/${id}`, 'DELETE')) router.refresh();
    setPending(null);
  }

  async function removeScreenshot(id: string) {
    setPending(id);
    setError(null);
    if (await request(`/api/admin/screenshots/${id}`, 'DELETE')) router.refresh();
    setPending(null);
  }

  return (
    <>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="admin-card">
        <h2>Release history</h2>
        <p className="muted">Upload a new build, or remove an old one. Uploads are capped at {maxApkMb} MB.</p>

        <div className="table-wrap" style={{ marginBottom: 22 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">File</th>
                <th scope="col">Size</th>
                <th scope="col">Downloads</th>
                <th scope="col">Uploaded</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {releases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                    No builds uploaded yet — this app cannot be published.
                  </td>
                </tr>
              ) : (
                releases.map((release) => (
                  <tr key={release.id}>
                    <td>
                      <strong>v{release.version}</strong>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{release.file_name}</td>
                    <td>{formatBytes(release.file_size)}</td>
                    <td>{formatCount(release.downloads)}</td>
                    <td>{formatDate(release.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => removeRelease(release.id)}
                          disabled={pending === release.id}
                        >
                          <IconTrash size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form ref={releaseForm} onSubmit={uploadRelease}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="new-version">New version *</label>
              <input id="new-version" name="version" className="input" required maxLength={40} placeholder="1.1.0" />
            </div>
            <div className="field">
              <label htmlFor="new-apk">APK file *</label>
              <input id="new-apk" name="apk" type="file" accept=".apk" className="input" required />
              <span className="field-hint">Validated as a real ZIP/APK, max {maxApkMb} MB.</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="new-changelog">Release notes</label>
            <textarea id="new-changelog" name="changelog" className="textarea" rows={3} />
          </div>

          <div className="form-actions" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
            <button className="btn btn-primary" type="submit" disabled={pending === 'release'}>
              {pending === 'release' ? 'Uploading…' : 'Upload build'}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Screenshots</h2>
        <p className="muted">Shown as a gallery on the app page. Up to 8 images.</p>

        {screenshots.length > 0 ? (
          <div className="thumb-grid">
            {screenshots.map((shot) => (
              <div className="thumb" key={shot.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${shot.mediaId}`} alt="App screenshot" />
                <button
                  type="button"
                  className="thumb-remove"
                  onClick={() => removeScreenshot(shot.id)}
                  aria-label="Remove screenshot"
                  disabled={pending === shot.id}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="field-hint">No screenshots yet.</p>
        )}

        <form ref={shotForm} onSubmit={uploadScreenshot} style={{ marginTop: 20 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="screenshot-file">Add a screenshot</label>
              <input
                id="screenshot-file"
                name="screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="input"
                required
              />
            </div>
          </div>

          <button className="btn btn-sm" type="submit" disabled={pending === 'screenshot'}>
            {pending === 'screenshot' ? 'Uploading…' : 'Upload screenshot'}
          </button>
        </form>
      </div>
    </>
  );
}
