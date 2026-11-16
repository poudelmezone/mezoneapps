'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { uploadFile } from '@/lib/client-upload';
import { CATEGORIES } from '@/lib/categories';
import type { AppDetail } from '@/lib/types';

type Props = {
  csrf: string;
  mode: 'create' | 'edit';
  app?: AppDetail;
  maxApkMb: number;
  /** `blob` when the deployment has no writable disk (Vercel). */
  uploadMode: 'server' | 'blob';
};

export default function AppForm({ csrf, mode, app, maxApkMb, uploadMode }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const released = app?.released_at ? new Date(app.released_at).toISOString().slice(0, 10) : '';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const url = mode === 'create' ? '/api/admin/apps' : `/api/admin/apps/${app?.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    try {
      const headers: Record<string, string> = { 'x-csrf-token': csrf };
      let body: BodyInit;

      if (uploadMode === 'blob') {
        const fields: Record<string, string | boolean> = {};
        for (const [key, value] of form.entries()) {
          if (typeof value === 'string') fields[key] = value;
        }
        fields.published = form.has('published');
        fields.featured = form.has('featured');

        const iconFile = form.get('icon');
        const apkFile = form.get('apk');
        const shotFiles = form
          .getAll('screenshots')
          .filter((entry): entry is File => entry instanceof File && entry.size > 0);

        setStage('Uploading icon…');
        const icon = iconFile instanceof File && iconFile.size > 0 ? await uploadFile(iconFile, 'image') : null;

        const screenshots = [];
        for (const file of shotFiles) {
          setStage(`Uploading ${file.name}…`);
          screenshots.push(await uploadFile(file, 'image'));
        }

        setStage('Uploading APK…');
        const apk = apkFile instanceof File && apkFile.size > 0 ? await uploadFile(apkFile, 'apk') : null;

        setStage('Saving…');
        body = JSON.stringify({ fields, icon, screenshots, apk });
        headers['Content-Type'] = 'application/json';
      } else {
        body = form;
      }

      const response = await fetch(url, { method, headers, body });
      const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string };

      if (!response.ok) {
        setError(data.error ?? 'The app could not be saved.');
        setPending(false);
        setStage(null);
        return;
      }

      if (mode === 'create' && data.id) {
        router.push(`/admin/apps/${data.id}`);
        router.refresh();
        return;
      }

      setPending(false);
      setStage(null);
      setSuccess('Saved. Public pages now show the new details.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed. Check the file type and size.');
      setPending(false);
      setStage(null);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} encType="multipart/form-data" className="form" noValidate>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      ) : null}

      <div className="admin-card">
        <h2>Listing</h2>
        <p className="muted">What visitors see on the homepage and the app page.</p>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">App name *</label>
            <input id="name" name="name" className="input" required maxLength={80} defaultValue={app?.name ?? ''} placeholder="Pixel Painter" />
          </div>

          <div className="field">
            <label htmlFor="slug">URL slug</label>
            <input
              id="slug"
              name="slug"
              className="input"
              maxLength={80}
              defaultValue={app?.slug ?? ''}
              placeholder="auto-generated from the name"
              pattern="[a-z0-9-]*"
            />
            <span className="field-hint">Lowercase letters, numbers and dashes.</span>
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={app?.category ?? 'Tools'}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="releasedAt">Release date</label>
            <input id="releasedAt" name="releasedAt" type="date" className="input" defaultValue={released} />
            <span className="field-hint">Shown as the app&apos;s release date. Defaults to today.</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="shortDescription">Short description *</label>
          <input
            id="shortDescription"
            name="shortDescription"
            className="input"
            required
            maxLength={160}
            defaultValue={app?.short_description ?? ''}
            placeholder="One line that sells the app in the grid."
          />
        </div>

        <div className="field">
          <label htmlFor="description">Full description</label>
          <textarea
            id="description"
            name="description"
            className="textarea"
            rows={8}
            maxLength={20000}
            defaultValue={app?.description ?? ''}
            placeholder="What it does, who it is for, how to use it. Blank lines start a new paragraph."
          />
        </div>

        <div className="field">
          <label htmlFor="changelog">Latest changelog</label>
          <textarea
            id="changelog"
            name="changelog"
            className="textarea"
            rows={4}
            maxLength={10000}
            defaultValue={app?.changelog ?? ''}
            placeholder="What changed in this release."
          />
        </div>

        <div className="field">
          <label htmlFor="icon">App icon</label>
          <input id="icon" name="icon" type="file" accept="image/png,image/jpeg,image/webp" className="input" />
          <span className="field-hint">
            PNG, JPEG or WebP up to 5 MB. Square images look best. Leave empty to keep the generated placeholder.
          </span>
        </div>

        <div className="form-grid">
          <label className="checkbox">
            <input type="checkbox" name="published" defaultChecked={Boolean(app?.published) || mode === 'create'} />
            Published (visible to visitors)
          </label>
          <label className="checkbox">
            <input type="checkbox" name="featured" defaultChecked={Boolean(app?.featured)} />
            Featured (pinned first)
          </label>
        </div>
      </div>

      {mode === 'create' ? (
        <div className="admin-card">
          <h2>First build</h2>
          <p className="muted">
            Required if you publish immediately. Files are validated and stored outside the web root; max {maxApkMb} MB.
          </p>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="version">Version *</label>
              <input id="version" name="version" className="input" maxLength={40} placeholder="1.0.0" />
            </div>

            <div className="field">
              <label htmlFor="apk">APK file</label>
              <input id="apk" name="apk" type="file" accept=".apk,application/vnd.android.package-archive" className="input" />
              <span className="field-hint">Only .apk files are accepted.</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="releaseChangelog">Release notes</label>
            <textarea id="releaseChangelog" name="releaseChangelog" className="textarea" rows={3} placeholder="First public release." />
          </div>

          <div className="field">
            <label htmlFor="screenshots">Screenshots</label>
            <input id="screenshots" name="screenshots" type="file" multiple accept="image/png,image/jpeg,image/webp" className="input" />
            <span className="field-hint">Up to 8 images. You can add or remove them later.</span>
          </div>
        </div>
      ) : null}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? stage ?? 'Saving…' : mode === 'create' ? 'Create app' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.push('/admin')}>
          Back to dashboard
        </button>
        {uploadMode === 'blob' && pending ? <span className="field-hint">Uploading directly to storage…</span> : null}
      </div>
    </form>
  );
}
