import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'APKForge — direct APK downloads',
    template: '%s · APKForge',
  },
  description:
    'The official download hub for Android apps: every build, every changelog, delivered straight from the developer.',
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  openGraph: {
    title: 'APKForge',
    description: 'Direct, developer-published APK downloads.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f1e9' },
    { media: '(prefers-color-scheme: dark)', color: '#17140f' },
  ],
};

/**
 * Runs before the first paint. Reads the stored choice, falls back to the OS
 * preference, and sets `data-theme` on <html> so there is no flash of the
 * wrong theme (and no hydration mismatch, because React never owns this).
 */
const themeBootstrap = `(function(){try{var k='apkforge-theme';var s=localStorage.getItem(k);var d=s==='dark'||(s===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);var t=d?'dark':'light';var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Runs before anything else in <body> is parsed, so the first paint is already correct. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
