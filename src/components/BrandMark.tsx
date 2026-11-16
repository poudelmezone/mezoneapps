/**
 * The MezoneApps mark: a rust tile with a drawn M, not a typed letter, so it
 * stays crisp from 20px in the header up to the favicon.
 */
export default function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="6" fill="var(--accent)" />
      <path
        d="M9.5 22.6V10.4L16 17.6l6.5-7.2v12.2"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
