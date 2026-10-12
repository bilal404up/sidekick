/** Wordmark glyph: an index card with a tab. Decorative. */
export function SidekickMark({ className = "" }: { className?: string }) {
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" aria-hidden="true" focusable="false" className={className}>
      <path d="M2 6h6.5L10 3h5l1.5 3H22v14H2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.5 11.5h13M5.5 15.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
