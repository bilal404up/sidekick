"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel, type ChatEvent, type ScriptStep } from "@/components/ChatPanel";
import { AdminEntry } from "@/components/AdminEntry";
import { citeLabel, citeMap } from "@/lib/cite";

export interface FaqLite {
  id: string;
  category: string;
  question: string;
  aliasOf?: string;
}
interface Line {
  key: number;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  n: number | null;
  visible: boolean;
}

const PIN = 9;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The hero stage: the live chat, the FAQ as a numbered index, and the owner's inbox, joined by a citation thread. */
export function HeroDemo({ llmOn, demo, faqs, script }: { llmOn: boolean; demo: boolean; faqs: FaqLite[]; script?: ScriptStep[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const linkRef = useRef<{ msgId: number; sourceId: string; drawn: boolean } | null>(null);
  const keyRef = useRef(0);
  const aliasRef = useRef(new Map<string, string>());
  aliasRef.current = new Map(faqs.filter((f) => f.aliasOf).map((f) => [f.id, f.aliasOf as string]));
  const [active, setActive] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [line, setLine] = useState<Line | null>(null);
  const [waiting, setWaiting] = useState<Array<{ key: string; question: string; example: boolean }>>([]);

  const cites = useMemo(() => citeMap(faqs), [faqs]);
  const citesRef = useRef(cites);
  citesRef.current = cites;
  const total = useMemo(() => faqs.filter((f) => !f.aliasOf).length, [faqs]);
  const groups = useMemo(() => {
    const map = new Map<string, FaqLite[]>();
    for (const f of faqs.filter((x) => !x.aliasOf)) map.set(f.category || "General", [...(map.get(f.category || "General") ?? []), f]);
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
    // The thread draws itself the first time both ends are on screen.
    if (visible && !link.drawn) {
      link.drawn = true;
      keyRef.current += 1;
    }
    const x1 = b.right - w.left;
    const x2 = e.left - w.left - 12;
    const ry1 = y1 - w.top;
    const ry2 = y2 - w.top;
    const sx = x1 + PIN;
    const ex = x2 - PIN;
    const mid = (sx + ex) / 2;
    setLine({
      key: keyRef.current,
      d: `M ${sx} ${ry1} C ${mid} ${ry1}, ${mid} ${ry2}, ${ex} ${ry2}`,
      x1,
      y1: ry1,
      x2,
      y2: ry2,
      n: citesRef.current[link.sourceId]?.n ?? null,
      visible,
    });
  }, []);

  const onEvent = useCallback((e: ChatEvent) => {
    if (e.type === "answer") {
      const target = aliasRef.current.get(e.sourceId) ?? e.sourceId;
      linkRef.current = { msgId: e.msgId, sourceId: target, drawn: false };
      setActive(target);
      setVersion((v) => v + 1);
    } else {
      setWaiting((w) => [{ key: `${Date.now()}-${w.length}`, question: e.question, example: e.example }, ...w].slice(0, 6));
    }
  }, []);

  // After a new answer renders: bring its index entry into view, then draw the thread.
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
    const t = window.setTimeout(measure, 360);
    return () => window.clearTimeout(t);
  }, [version, measure]);

  // Keep the thread attached while either pane scrolls, the window resizes, or a source opens or closes.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const mo = new MutationObserver(on);
    mo.observe(wrap, { childList: true, subtree: true });
    wrap.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      mo.disconnect();
      wrap.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  const latest = waiting[0];

  return (
    <div ref={wrapRef} className="relative">
      <div className="grid gap-6 lg:h-[620px] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,7fr)_minmax(0,3.7fr)_minmax(0,2.3fr)]">
        <ChatPanel llmOn={llmOn} script={script} cites={cites} onEvent={onEvent} className="h-[540px] lg:h-auto" />

        <section aria-label="The shop's FAQ, numbered" className="hidden min-h-0 flex-col lg:flex">
          <header className="flex items-baseline justify-between gap-3 border-b border-ink pb-2.5 pt-1">
            <h3 className="label text-ink">The FAQ it answers from</h3>
            <span className="font-mono text-[12px] leading-4 text-ink-2">{total} entries</span>
          </header>
          {faqs.length === 0 ? (
            <p className="py-4 text-[14px] leading-5 text-ink-2">The FAQ couldn&apos;t be loaded right now.</p>
          ) : (
            <ul ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto pb-4">
              {groups.map(([cat, items]) => (
                <li key={cat}>
                  <p className="label sticky top-0 z-[1] border-b border-rule bg-paper/95 pb-1.5 pt-4 text-ink-2 backdrop-blur-sm">{cat}</p>
                  <ul>
                    {items.map((f) => (
                      <li key={f.id} data-faq={f.id} data-active={active === f.id} className="entry grid grid-cols-[40px_minmax(0,1fr)] rounded-xs py-[7px] pr-2 text-[14px] leading-5">
                        <span className="num cite pl-2 text-[12px] leading-5">{cites[f.id] ? citeLabel(cites[f.id].n) : ""}</span>
                        <span className="q text-ink">{f.question}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Owner's inbox" className="hidden min-h-0 flex-col xl:flex">
          <header className="flex items-center justify-between gap-3 border-b border-ink pb-2 pt-0.5">
            <h3 className="label text-ink">Owner&apos;s inbox</h3>
            <span key={waiting.length} className={`count ${waiting.length ? "anim-bump bg-ember text-white" : "bg-[#E6E2D7] text-ink-2"}`}>
              {waiting.length}
              <span className="sr-only"> waiting</span>
            </span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            {waiting.length === 0 ? (
              <p className="text-[14px] leading-[21px] text-ink-2">Questions the FAQ can&apos;t answer land here, so the owner can answer them once.</p>
            ) : (
              <ul className="space-y-3">
                {waiting.map((w) => (
                  <li key={w.key} className="anim-ticket rounded-sm border border-rule bg-sheet p-3 shadow-[inset_2px_0_0_#B3501A]">
                    <p className="label text-ember-dark">{w.example ? "Example" : "Just now"}</p>
                    <p className="mt-1.5 text-[14px] leading-5">{w.question}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-rule pt-4">
            <p className="mb-3 text-[13px] leading-[19px] text-ink-2">The owner answers once. Every customer gets that answer after.</p>
            <div className="[&>span]:flex [&>span]:w-full [&>span]:items-stretch">
              <AdminEntry demo={demo} className="btn-secondary w-full" />
            </div>
          </div>
        </section>
      </div>

      {/* Below xl the inbox column becomes a strip, so phones still see where unanswered questions go. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-rule bg-sheet px-4 py-3 xl:hidden">
        <div className="min-w-0">
          <p className="label flex items-center gap-2 text-ink-2">
            <span key={waiting.length} className={`count ${waiting.length ? "anim-bump bg-ember text-white" : "bg-[#E6E2D7] text-ink-2"}`}>
              {waiting.length}
            </span>
            Waiting in the owner&apos;s inbox
          </p>
          <p className="mt-1.5 truncate text-[14px] leading-5 text-ink">{latest ? latest.question : "Questions the FAQ can't answer go here."}</p>
        </div>
        <AdminEntry demo={demo} className="btn-secondary shrink-0 px-3" label="Owner view" />
      </div>

      {faqs.length > 0 && (
        <details className="group mt-3 rounded-lg border border-rule bg-sheet lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
            <span className="label text-ink">The FAQ it answers from</span>
            <span className="flex items-center gap-2 font-mono text-[12px] text-ink-2">
              {total} entries
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="transition-transform duration-150 group-open:rotate-180">
                <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
          <ul className="max-h-[380px] overflow-y-auto border-t border-rule px-2 pb-3">
            {groups.map(([cat, items]) => (
              <li key={cat}>
                <p className="label px-2 pb-1 pt-3 text-ink-2">{cat}</p>
                <ul>
                  {items.map((f) => (
                    <li key={f.id} data-active={active === f.id} className="entry grid grid-cols-[40px_minmax(0,1fr)] rounded-xs py-1.5 pr-2 text-[14px] leading-5">
                      <span className="num cite pl-2 text-[12px] leading-5">{cites[f.id] ? citeLabel(cites[f.id].n) : ""}</span>
                      <span className="q">{f.question}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}

      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full overflow-visible lg:block">
        {line && (
          <g key={line.key} className={`transition-opacity duration-150 ${line.visible ? "opacity-100" : "opacity-0"}`}>
            <path d={line.d} pathLength={1} fill="none" stroke="#1D5A3C" strokeWidth={1.25} strokeLinecap="round" strokeDasharray="1" className="anim-draw" />
            <Pin x={line.x1} y={line.y1} n={line.n} className="anim-pin" />
            <Pin x={line.x2} y={line.y2} n={line.n} className="anim-pin-late" />
          </g>
        )}
      </svg>
    </div>
  );
}

function Pin({ x, y, n, className }: { x: number; y: number; n: number | null; className: string }) {
  return (
    <g className={className}>
      <circle cx={x} cy={y} r={PIN} fill="#1D5A3C" stroke="#F5F3EC" strokeWidth={2} />
      {n !== null && (
        <text x={x} y={y + 3.3} textAnchor="middle" fontSize="9.5" fontWeight={500} fill="#FFFFFF" style={{ fontFamily: "var(--font-mono), monospace" }}>
          {String(n).padStart(2, "0")}
        </text>
      )}
    </g>
  );
}
