'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconTrash } from '@/components/icons';

type Props = {
  appId: string;
  csrf: string;
  published: boolean;
  name: string;
};

export default function RowActions({ appId, csrf, published, name }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set('published', published ? 'false' : 'true');

    const response = await fetch(`/api/admin/apps/${appId}`, {
      method: 'PATCH',
      headers: { 'x-csrf-token': csrf },
      body,
    }).catch(() => null);

    if (!response || !response.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(data?.error ?? 'Could not change the status.');
      setPending(false);
      return;
    }

    setPending(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete “${name}” and all of its APK files? This cannot be undone.`)) return;

    setPending(true);
    setError(null);
    const response = await fetch(`/api/admin/apps/${appId}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf },
    }).catch(() => null);

    if (!response || !response.ok) {
      setError('Could not delete this app.');
      setPending(false);
      return;
    }

    setPending(false);
    router.refresh();
  }

  return (
    <div>
      <div className="row-actions">
        <button type="button" className="btn btn-sm" onClick={toggle} disabled={pending}>
          {published ? 'Unpublish' : 'Publish'}
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={pending}>
          <IconTrash size={14} />
          Delete
        </button>
      </div>
      {error ? (
        <p className="field-hint" style={{ color: 'var(--danger)', marginTop: 6, textAlign: 'right' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
