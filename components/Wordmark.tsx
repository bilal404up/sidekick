/** The Sidekick mark: a section sign in a square, the citation the product is built around. */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false" className={className}>
      <rect x="0.75" y="0.75" width="26.5" height="26.5" rx="3.25" fill="#16181B" />
      <text x="14" y="20.2" textAnchor="middle" style={{ fontFamily: "var(--font-display), Georgia, serif" }} fontSize="19" fill="#F5F3EC">
        &#167;
      </text>
    </svg>
  );
}

export function Wordmark({ suffix }: { suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-ink">
      <Mark />
      <span className="display text-[23px] leading-none tracking-[-0.01em]">Sidekick</span>
      {suffix && <span className="label ml-1 border-l border-rule-strong pl-3 text-ink-2">{suffix}</span>}
    </span>
  );
}
