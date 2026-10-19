"use client";

import type { CSSProperties } from "react";
import { useInView } from "@/components/motion/useInView";

const delay = (ms: number, steps?: number) =>
  ({ ["--d" as string]: `${ms}ms`, ...(steps ? { ["--steps" as string]: String(steps) } : {}) }) as CSSProperties;

/* One scene of the owner flow. It plays once, when its card is 55% in view.
   Every piece is a CSS animation keyed on [data-in] (see globals.css), so the card is complete
   without JS and with reduced motion. The copy comes from the server page, so the strings stay real. */
export function OwnerStep({ step, question, answer, unknown }: { step: number; question: string; answer: string; unknown: string }) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.55, rootMargin: "0px" });
  return (
    <div ref={ref} aria-hidden="true" data-scene={step} data-in={inView ? "true" : undefined} className="card mt-auto min-h-[236px] p-5">
      {step === 0 && (
        <div className="space-y-3">
          <p className="os-rise ml-auto w-fit max-w-[85%] rounded-lg rounded-br-xs bg-ink px-3.5 py-2 text-[14px] leading-5 text-paper" style={delay(0)}>
            {question}
          </p>
          <p className="os-fade label flex items-center gap-2 text-ember-dark" style={delay(500)}>
            <span className="h-px w-4 bg-ember" />
            Not in the FAQ
          </p>
          <div className="relative pl-3.5">
            <span aria-hidden="true" className="os-bar absolute bottom-0 left-0 top-0 w-[2px] bg-ember" style={delay(800)} />
            <p className="os-fade text-[14px] leading-[21px]" style={delay(1100)}>
              {unknown}.
            </p>
          </div>
          <p className="os-slide inline-flex rounded-sm border border-dashed border-ember/60 bg-ember-tint px-2.5 py-1 font-mono text-[12px] leading-4 text-ember-dark" style={delay(1700)}>
            Sent to the owner
          </p>
        </div>
      )}
      {step === 1 && (
        <div>
          <p className="os-fade label text-ember-dark" style={delay(0)}>
            Open &middot; just now
          </p>
          <p className="display mt-1.5 text-[22px] leading-7">
            <span className="os-type" style={delay(300, 28)}>
              &ldquo;{question}&rdquo;
            </span>
          </p>
          <div className="mt-3 rounded-sm border border-ink bg-sheet px-3 py-2 text-[14px] leading-[21px]">
            <span className="os-type" style={delay(1300, 60)}>
              {answer}
            </span>
            <span className="os-caret ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-ink" style={delay(2300)} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="os-press inline-flex min-h-9 items-center rounded-sm bg-moss px-3 text-[14px] font-medium text-white" style={delay(2500)}>
              Add to FAQ
            </span>
            <span className="font-mono text-[12px] text-ink-2">Ctrl + Enter</span>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <p className="os-rise ml-auto w-fit max-w-[85%] rounded-lg rounded-br-xs bg-ink px-3.5 py-2 text-[14px] leading-5 text-paper" style={delay(0)}>
            {question}
          </p>
          <div className="os-rise rounded-lg rounded-bl-xs bg-paper px-3.5 pt-2.5 text-[14px] leading-[21px]" style={delay(500)}>
            {answer}
            <p className="mt-2.5 flex min-h-10 items-center gap-2 border-t border-rule text-[13px] text-ink-2">
              <span className="os-chip inline-block cite rounded-xs bg-moss px-1.5 py-0.5 text-[12px] leading-4 text-white" style={delay(1100)}>
                &#167; new
              </span>
              General &middot; your answer
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
