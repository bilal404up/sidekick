"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel, type ChatEvent, type ScriptStep } from "@/components/ChatPanel";
import { AdminEntry } from "@/components/AdminEntry";

export interface FaqLite {
  id: string;
  category: string;
  question: string;
}
interface Line {
  key: number;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  visible: boolean;
}

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The hero: live chat, the FAQ it answers from, and the owner's inbox, joined by a source line. */
export function HeroDemo({ llmOn, demo, faqs, script }: { llmOn: boolean; demo: boolean; faqs: FaqLite[]; script?: ScriptStep[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const linkRef = useRef<{ msgId: number; sourceId: string; drawn: boolean } | null>(null);
  const keyRef = useRef(0);
  const [active, setActive] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [line, setLine] = useState<Line | null>(null);
  const [waiting, setWaiting] = useState<Array<{ key: string; question: string; example: boolean }>>([]);

  const groups = useMemo(() => {
    const map = new Map<string, FaqLite[]>();
    for (const f of faqs) map.set(f.category || "General", [...(map.get(f.category || "General") ?? []), f]);
    return Array.from(map.entries());
  }, [faqs]);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const list = listRef.current;
    const link = linkRef.current;
    if (!wrap || !list || !link || list.offsetParent === null) {
      setLine(null);
      return;
    }
    const msg = wrap.querySelector<HTMLElement>(`[data-msg="${link.msgId}"]`);
    const bubble = msg?.querySelector<HTMLElement>("[data-bubble]");
    const dot = msg?.querySelector<HTMLElement>("[data-anchor]");
    const log = msg?.closest<HTMLElement>('[role="log"]');
    const entry = list.querySelector<HTMLElement>(`[data-faq="${CSS.escape(link.sourceId)}"]`);
    if (!bubble || !dot || !log || !entry) {
      setLine(null);
      return;
    }
    const w = wrap.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const d = dot.getBoundingClientRect();
    const e = entry.getBoundingClientRect();
    const lr = log.getBoundingClientRect();
    const fr = list.getBoundingClientRect();
    const y1 = d.top + d.height / 2;
    const y2 = e.top + e.height / 2;
    const visible = y1 > lr.top && y1 < lr.bottom && y2 > fr.top && y2 < fr.bottom;
    // The line draws itself the first time both ends are on screen.
    if (visible && !link.drawn) {
      link.drawn = true;
      keyRef.current += 1;
    }
    const x1 = b.right - w.left;
    const x2 = e.left - w.left + 3;
    const ry1 = y1 - w.top;
    const ry2 = y2 - w.top;
    const mid = (x1 + x2) / 2;
    setLine({ key: keyRef.current, d: `M ${x1} ${ry1} C ${mid} ${ry1}, ${mid} ${ry2}, ${x2} ${ry2}`, x1, y1: ry1, x2, y2: ry2, visible });
  }, []);

  const onEvent = useCallback((e: ChatEvent) => {
    if (e.type === "answer") {
      linkRef.current = { msgId: e.msgId, sourceId: e.sourceId, drawn: false };
      setActive(e.sourceId);
      setVersion((v) => v + 1);
    } else {
      setWaiting((w) => [{ key: `${Date.now()}-${w.length}`, question: e.question, example: e.example }, ...w].slice(0, 6));
    }
  }, []);

  // After a new answer renders: bring its FAQ entry into view, then draw the line.
  useEffect(() => {
    if (!version) return;
    const list = listRef.current;
    const link = linkRef.current;
    if (!list || !link || list.offsetParent === null) return;
    const entry = list.querySelector<HTMLElement>(`[data-faq="${CSS.escape(link.sourceId)}"]`);
    if (entry) {
      list.scrollTo({ top: Math.max(0, entry.offsetTop - list.clientHeight / 2 + entry.offsetHeight / 2), behavior: reduceMotion() ? "auto" : "smooth" });
    }
    measure();
    const t = window.setTimeout(measure, 320);
    return () => window.clearTimeout(t);
  }, [version, measure]);

  // Keep the line attached while either pane scrolls or the window resizes.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    wrap.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      wrap.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  return (
    <div
      ref={wrapRef}
      className="relative grid gap-4 lg:h-[calc(100vh-236px)] lg:max-h-[640px] lg:min-h-[460px] lg:grid-cols-[minmax(360px,420px)_minmax(0,1fr)_minmax(260px,300px)]"
    >
      <ChatPanel llmOn={llmOn} script={script} onEvent={onEvent} className="h-[600px] lg:h-auto" />

      <section aria-label="The shop's FAQ" className="panel hidden min-h-0 flex-col overflow-hidden lg:flex">
        <header className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
          <h3 className="text-[15px] leading-5 tracking-normal">The FAQ it answers from</h3>
          <span className="text-[12px] leading-4 text-ink-muted">{faqs.length} entries</span>
        </header>
        {faqs.length === 0 ? (
          <p className="p-4 text-[14px] leading-5 text-ink-muted">The FAQ couldn&apos;t be loaded right now.</p>
        ) : (
          <ul ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto pb-2">
            {groups.map(([cat, items]) => (
              <li key={cat}>
                <p className="sticky top-0 z-[1] bg-surface/95 px-4 pb-1 pt-3 text-[12px] font-semibold leading-4 text-ink-muted backdrop-blur-sm">{cat}</p>
                <ul>
                  {items.map((f) => (
                    <li key={f.id} data-faq={f.id} data-active={active === f.id} className="entry mx-2 rounded-lg px-2.5 py-2 text-[14px] leading-5 text-ink">
                      {f.question}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Owner's inbox" className="panel hidden min-h-0 flex-col overflow-hidden lg:flex">
        <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
          <h3 className="text-[15px] leading-5 tracking-normal">Owner&apos;s inbox</h3>
          <span
            key={waiting.length}
            className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold leading-4 ${waiting.length ? "anim-bump bg-asked-soft text-asked-dark" : "bg-canvas text-ink-muted"}`}
          >
            {waiting.length} waiting
          </span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {waiting.length === 0 ? (
            <p className="px-1 py-1 text-[14px] leading-5 text-ink-muted">Questions the FAQ can&apos;t answer land here, so the owner can answer them once.</p>
          ) : (
            <ul className="space-y-2">
              {waiting.map((w) => (
                <li key={w.key} className="anim-rise rounded-lg border border-rule p-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold leading-4 text-asked-dark">
                    <span aria-hidden="true" className="dot bg-asked" />
                    {w.example ? "Example" : "Just now"}
                  </p>
                  <p className="mt-1 text-[14px] leading-5">{w.question}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-rule p-3">
          <p className="mb-2 text-[13px] leading-[18px] text-ink-muted">The owner writes the answer once. Every customer gets it after that.</p>
          <div className="[&>span]:flex [&>span]:w-full [&>span]:items-stretch">
            <AdminEntry demo={demo} className="btn-secondary w-full" />
          </div>
        </div>
      </section>

      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full overflow-visible lg:block">
        {line && (
          <g key={line.key} className={`transition-opacity duration-150 ${line.visible ? "opacity-100" : "opacity-0"}`}>
            <path d={line.d} pathLength={1} fill="none" stroke="#117A4A" strokeWidth={2} strokeLinecap="round" strokeDasharray="1" className="anim-draw" />
            <circle cx={line.x1} cy={line.y1} r={3.5} fill="#117A4A" />
            <circle cx={line.x2} cy={line.y2} r={3.5} fill="#117A4A" />
          </g>
        )}
      </svg>
    </div>
  );
}
