'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignOutButton({ csrf }: { csrf: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'x-csrf-token': csrf },
        }).catch(() => undefined);
        router.replace('/admin/login');
        router.refresh();
      }}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
