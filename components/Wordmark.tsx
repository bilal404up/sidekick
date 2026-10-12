/** The Sidekick wordmark: a small ink tile with the green source dot. */
export function Wordmark({ suffix }: { suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink">
      <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-md bg-ink">
        <span className="h-2 w-2 rounded-full bg-[#3FB27F]" />
      </span>
      Sidekick
      {suffix && <span className="text-[14px] font-medium text-ink-muted">{suffix}</span>}
    </span>
  );
}
