'use client';

/** Animates every route change in, so pages never pop abruptly. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
