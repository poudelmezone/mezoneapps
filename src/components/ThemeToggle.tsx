'use client';

import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from './icons';

const STORAGE_KEY = 'apkforge-theme';
type Theme = 'light' | 'dark';

function applyTheme(next: Theme) {
  const root = document.documentElement;
  root.dataset.theme = next;
  root.style.colorScheme = next;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  // Sync React with whatever the bootstrap script already decided.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  // Keep following the OS until the visitor makes an explicit choice.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(STORAGE_KEY);
      } catch {
        /* storage disabled */
      }
      if (stored) return;

      const next: Theme = event.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage disabled — the choice still applies for this visit */
    }
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </span>
      <span className="theme-toggle-text" suppressHydrationWarning>
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
