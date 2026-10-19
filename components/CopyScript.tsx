"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* The install snippet in a window frame, with a Copy button. The children are the coloured code spans from the page. */
export function CopyScript({ snippet, children }: { snippet: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-night-rule bg-black/25">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-night-rule pl-4 pr-1">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-night-rule" />
            <span className="h-2.5 w-2.5 rounded-full bg-night-rule" />
            <span className="h-2.5 w-2.5 rounded-full bg-night-rule" />
          </span>
          <span className="truncate font-mono text-[12px] leading-4 text-night-2">index.html</span>
        </div>
        <div className="copy-btn flex shrink-0 items-center">
          <span className="sr-only" aria-live="polite">
            {copied ? "Script copied to the clipboard" : ""}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center px-3 text-[13px] font-medium text-night-ink underline-offset-4 hover:underline"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className="flex">
        <span aria-hidden="true" className="select-none px-4 pt-6 font-mono text-[12px] leading-7 text-night-2 sm:pt-8 sm:leading-9">
          1
        </span>
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words py-6 pr-6 font-mono text-[15px] leading-7 sm:py-8 sm:pr-8 sm:text-[19px] sm:leading-9">
          {children}
        </pre>
      </div>
    </div>
  );
}
