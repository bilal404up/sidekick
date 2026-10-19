"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Reply } from "@/lib/engine/respond";
import { AnswerText } from "@/components/AnswerText";
import { citeLabel, type Cite } from "@/lib/cite";

export type ChatEvent = { type: "answer"; msgId: number; sourceId: string } | { type: "unknown"; question: string; example: boolean };
export interface ScriptStep {
  question: string;
  reply: Reply;
}

interface Msg {
  id: number;
  role: "user" | "bot" | "error" | "note";
  text: string;
  example?: boolean;
  autoOpen?: boolean;
  kind?: Reply["kind"];
  mode?: Reply["mode"];
  sourceId?: string;
  sourceQ?: string;
  original?: string;
  headline?: string;
  related?: string[];
  note?: string;
  partial?: boolean;
  stems?: string[];
  strength?: number;
  threshold?: number;
  keywordsOnly?: string[];
}

const CHIPS: Array<{ label: string; note?: string }> = [
  { label: "How much is shipping?" },
  { label: "Can I return a plant that died?" },
  { label: "How often should I water succulents?" },
  { label: "Can you recommend a laptop?", note: "Not in the FAQ" },
];
const COVERED = CHIPS.filter((c) => !c.note).map((c) => c.label);
const MAX = 500;
const GREETING = "Hi, I'm Fernbrook's assistant. I answer from the shop's FAQ and tell you when something isn't covered.";
const MODE_NOTE: Record<string, string> = {
  faq: "Quoted word for word from the FAQ.",
  model: "Reworded by the language model from this entry only.",
  "model-fallback": "The language model didn't respond, so this is the entry word for word.",
};
const isWide = () => window.matchMedia("(min-width: 1024px)").matches;

function toMsg(r: Partial<Reply>, id: number, example: boolean): Msg {
  const src = r.sources?.[0];
  return {
    id,
    role: "bot",
    example,
    text: r.text ?? "",
    kind: r.kind,
    mode: r.mode,
    sourceId: src?.id,
    sourceQ: src?.question,
    original: r.card?.answer,
    headline: r.headline,
    related: Array.isArray(r.related) ? r.related.filter((q) => typeof q === "string").slice(0, 2) : undefined,
    note: r.note,
    partial: r.coverage === "partial",
    stems: r.match?.stems,
    strength: r.match?.strength,
    threshold: r.match?.threshold,
    keywordsOnly: r.match?.keywordsOnly,
  };
}

export function ChatPanel({
  llmOn,
  className = "",
  variant = "page",
  script,
  cites,
  onEvent,
}: {
  llmOn: boolean;
  className?: string;
  variant?: "page" | "widget";
  script?: ScriptStep[];
  /** Citation numbers by FAQ id. Without them an answer shows its entry's question instead. */
  cites?: Record<string, Cite>;
  onEvent?: (e: ChatEvent) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, role: "bot", kind: "smalltalk", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const idRef = useRef(1);
  const stopRef = useRef(false);
  const openedRef = useRef(false);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const compact = variant === "widget";

  // Keep the newest message's top in view. A long answer is never scrolled past its first line.
  useLayoutEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.clientHeight;
    const items = Array.from(el.querySelectorAll<HTMLElement>("[data-item]:not([data-note])"));
    const last = items[items.length - 1];
    el.scrollTop = last ? Math.min(bottom, Math.max(0, last.offsetTop - 16)) : bottom;
  }, [messages, busy, typing]);

  function emit(m: Msg, question: string) {
    if (m.kind === "answer" && m.sourceId) eventRef.current?.({ type: "answer", msgId: m.id, sourceId: m.sourceId });
    else if (m.kind === "unknown") eventRef.current?.({ type: "unknown", question, example: Boolean(m.example) });
  }

  // The example run: real engine output rendered on the server. Nothing is sent to the API or saved.
  useEffect(() => {
    if (!script?.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    let t = 700;
    const at = (fn: () => void) => {
      const delay = reduce ? 0 : t;
      timers.push(window.setTimeout(() => !stopRef.current && fn(), delay));
    };
    at(() => setMessages((m) => [...m, { id: idRef.current++, role: "note", text: "Example, played for you. Not saved." }]));
    for (const s of script) {
      t += 500;
      at(() => setMessages((m) => [...m, { id: idRef.current++, role: "user", text: s.question, example: true }]));
      t += 450;
      at(() => setTyping(true));
      t += 900;
      at(() => {
        setTyping(false);
        const msg = toMsg(s.reply, idRef.current++, true);
        // The first sourced example opens its source, so the citation thread draws on first view.
        if (msg.kind === "answer" && !openedRef.current) {
          openedRef.current = true;
          msg.autoOpen = true;
        }
        setMessages((m) => [...m, msg]);
        emit(msg, s.question);
      });
      t += 1600;
    }
    at(() => setMessages((m) => [...m, { id: idRef.current++, role: "note", text: "Your turn." }]));
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    stopRef.current = true;
    setTyping(false);
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: idRef.current++, role: "user", text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [...m, { id: idRef.current++, role: "error", text: data.error ?? "Something went wrong. Try again." }]);
      } else {
        const msg = toMsg((data.reply ?? {}) as Partial<Reply>, idRef.current++, false);
        setMessages((m) => [...m, msg]);
        emit(msg, text);
      }
    } catch {
      setMessages((m) => [...m, { id: idRef.current++, role: "error", text: "Could not reach the server. Check your connection and try again." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section
      aria-label="Chat with the shop assistant"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-sheet ${compact ? "" : "rounded-lg border border-rule shadow-sheet"} ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <ShopMark />
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold leading-5">Fernbrook Garden Supply</h2>
            <p className="truncate text-[13px] leading-[18px] text-ink-2">
              <span className="sm:hidden">{llmOn ? "Rewording on" : "Quoting the FAQ"}</span>
              <span className="hidden sm:inline">Answers from the shop&apos;s FAQ</span>
            </p>
          </div>
        </div>
        <span className="label hidden shrink-0 items-center gap-2 rounded-sm border border-rule px-2 py-1.5 text-ink-2 sm:inline-flex">
          <span aria-hidden="true" className={`dot ${llmOn ? "bg-ember" : "bg-moss"}`} />
          {llmOn ? "Rewording on" : "Quoting the FAQ"}
        </span>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.map((m) => (
          <Entry key={m.id} m={m} cite={m.sourceId ? cites?.[m.sourceId] : undefined} compact={compact} onAsk={send} disabled={busy} />
        ))}
        {(busy || typing) && (
          <div data-item className="flex items-center gap-2.5 pl-1" aria-label="The assistant is typing">
            <span aria-hidden="true" className="typing inline-flex gap-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            <span className="font-mono text-[12px] leading-4 text-ink-2">Checking the FAQ</span>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-rule bg-sheet"
      >
        <div role="group" aria-label="Try a question" className="flex items-center gap-3 pl-4 pt-3 sm:pl-5">
          <span aria-hidden="true" className="label hidden shrink-0 text-ink-2 sm:block">
            Try
          </span>
          <div className="scroll-row flex min-w-0 flex-1 gap-2 overflow-x-auto pr-8">
            {CHIPS.map((c) => (
              <button key={c.label} type="button" onClick={() => send(c.label)} disabled={busy} className="chip">
                {c.label}
                {c.note && <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-ember-dark">{c.note}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 pb-3 pt-3 sm:px-5">
          <label htmlFor="sk-input" className="sr-only">
            Your question
          </label>
          <div className="flex gap-2">
            <input
              id="sk-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX))}
              placeholder="Ask about shipping, returns, plants"
              autoComplete="off"
              className="field h-12 min-w-0"
            />
            <button type="submit" disabled={busy || input.trim().length === 0} className="btn-primary h-12 shrink-0 px-5">
              Send
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-[18px] text-ink-3">
            {input.length > 400 ? `${MAX - input.length} characters left. ` : ""}
            Saved for the owner to review. Emails and phone numbers are removed first.
          </p>
        </div>
      </form>
    </section>
  );
}

/** Fernbrook's avatar: a small fern frond, not a letter in a circle. */
function ShopMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" focusable="false" className="shrink-0">
      <circle cx="18" cy="18" r="17.5" fill="#E2ECE4" stroke="#C9D8CD" />
      <path d="M17.6 28.5C17.9 21.5 18.4 15 20.4 8.5" fill="none" stroke="#1D5A3C" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M17.8 25C14.6 24.6 12.5 22.6 12 20.4c2.6.2 4.7 2 5.8 4.6Z" fill="#1D5A3C" />
      <path d="M18 21.6c3.3-.3 5.3-2.3 5.9-4.4-2.6.2-4.9 1.9-5.9 4.4Z" fill="#1D5A3C" />
      <path d="M18.4 17.6c-2.7-.6-4.2-2.5-4.4-4.4 2.3.4 3.8 2.1 4.4 4.4Z" fill="#1D5A3C" />
      <path d="M19.1 14c2.5-.4 3.9-2 4.3-3.7-2 .2-3.6 1.6-4.3 3.7Z" fill="#1D5A3C" />
    </svg>
  );
}

function Entry({ m, cite, compact, onAsk, disabled }: { m: Msg; cite?: Cite; compact: boolean; onAsk: (q: string) => void; disabled: boolean }) {
  if (m.role === "note") {
    return (
      <p data-item data-note className="anim-fade flex items-center gap-3 py-1 font-mono text-[12px] uppercase leading-4 tracking-[0.06em] text-ink-2">
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
        {m.text}
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
      </p>
    );
  }
  if (m.role === "user") {
    return (
      <div data-item className="anim-rise flex justify-end">
        <p className="max-w-[85%] rounded-lg rounded-br-xs bg-ink px-4 py-2.5 text-[15px] leading-[22px] text-paper">{m.text}</p>
      </div>
    );
  }
  if (m.role === "error") {
    return (
      <p data-item role="alert" className="rounded-lg border border-error/40 bg-sheet px-4 py-2.5 text-[14px] leading-5 text-error">
        {m.text}
      </p>
    );
  }
  if (m.kind === "answer") return <Answer m={m} cite={cite} compact={compact} onAsk={onAsk} disabled={disabled} />;
  if (m.kind === "unknown") return <NotFound m={m} onAsk={onAsk} disabled={disabled} />;
  return (
    <p data-item className="anim-rise max-w-[94%] rounded-lg rounded-bl-xs bg-paper px-4 py-3 text-[15px] leading-[23px]">
      {m.text}
    </p>
  );
}

function Answer({ m, cite, compact, onAsk, disabled }: { m: Msg; cite?: Cite; compact: boolean; onAsk: (q: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const verbatim = m.mode !== "model";
  const stems = new Set(m.stems ?? []);
  const entryText = verbatim ? m.text : m.original;
  const strength = m.strength !== undefined ? Math.round(m.strength * 100) : null;

  useEffect(() => {
    if (m.autoOpen && !compact && isWide()) setOpen(true);
  }, [m.autoOpen, compact]);

  // Wide screens open the source inside the answer, next to the FAQ index. Phones get an index-card sheet.
  function show() {
    if (!compact && !isWide() && sheetRef.current?.showModal) {
      sheetRef.current.showModal();
      return;
    }
    setOpen((o) => !o);
  }

  const label = cite ? citeLabel(cite.n) : null;

  return (
    <div data-msg={m.id} data-item className="anim-rise max-w-[94%]">
      {m.headline && <p className="mb-2 pl-0.5 text-[13px] font-medium leading-[18px] text-moss">{m.headline}</p>}
      <div data-bubble className="rounded-lg rounded-bl-xs bg-paper px-4 pt-3 text-[15px] leading-[23px]">
        <div className={open ? "sweep" : ""}>{verbatim ? <AnswerText text={m.text} stems={open ? stems : undefined} /> : <p className="whitespace-pre-line">{m.text}</p>}</div>
        {m.sourceQ ? (
          <div className="mt-3 border-t border-rule">
            <button type="button" aria-expanded={open} onClick={show} className="group flex min-h-11 w-full items-center gap-2.5 text-left text-[13px] leading-[18px]">
              <span data-anchor className="cite inline-flex shrink-0 items-center rounded-xs bg-moss px-1.5 py-0.5 text-[12px] leading-4 text-white">
                {label ?? "§"}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-2">
                {cite ? cite.category : m.sourceQ}
                {strength !== null && <span className="cite"> &middot; {Math.min(strength, 100)}% match</span>}
              </span>
              <span className="shrink-0 font-medium text-ink underline decoration-rule-strong underline-offset-4 group-hover:decoration-ink">
                {open ? "Hide source" : "Show source"}
              </span>
            </button>
            {open && (
              <div className="anim-fade -mx-4 border-t border-rule bg-sheet/60 px-4 pb-4 pt-3">
                <SourceDetail m={m} label={label} cite={cite} stems={stems} entryText={verbatim ? undefined : entryText} />
              </div>
            )}
          </div>
        ) : (
          <div className="pb-3" />
        )}
      </div>
      {(m.partial || m.note) && (
        <p className="anim-fade mt-2 border-l-2 border-ember pl-3 text-[13px] leading-[19px] text-ember-dark">{m.note ?? "Part of your question isn't covered by this entry."}</p>
      )}
      {m.related && m.related.length > 0 && !m.example && <Suggest label="Also in the FAQ" items={m.related} onAsk={onAsk} disabled={disabled} />}
      {m.sourceQ && !compact && (
        <dialog
          ref={sheetRef}
          className="sheet-dialog"
          aria-labelledby={`src-${m.id}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) sheetRef.current?.close();
          }}
        >
          <div className="px-5 pb-7 pt-3">
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule" />
            <div className="flex items-center justify-between gap-3 border-b border-rule pb-2">
              <p id={`src-${m.id}`} className="label text-ink-2">
                Source entry
              </p>
              <button type="button" onClick={() => sheetRef.current?.close()} className="btn-quiet -mr-2">
                Close
              </button>
            </div>
            <div className="sweep pt-4">
              <SourceDetail m={m} label={label} cite={cite} stems={stems} entryText={entryText} />
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

/** The cited entry: number, question, the entry text when it isn't already shown, the match against the bar, and how the answer was made. */
function SourceDetail({ m, label, cite, stems, entryText }: { m: Msg; label: string | null; cite?: Cite; stems: Set<string>; entryText?: string }) {
  const strength = m.strength !== undefined ? Math.round(m.strength * 100) : null;
  const threshold = m.threshold !== undefined ? Math.round(m.threshold * 100) : null;
  return (
    <div className="text-[14px] leading-[21px]">
      <p className="flex items-baseline gap-2">
        {label && <span className="cite text-[13px] text-moss">{label}</span>}
        {cite && <span className="label text-ink-2">{cite.category}</span>}
        {!label && <span className="label text-ink-2">From the FAQ</span>}
      </p>
      <AnswerText text={m.sourceQ ?? ""} stems={stems} className="mt-1.5 text-[15px] font-semibold leading-[22px]" />
      {entryText && <AnswerText text={entryText} stems={stems} className="mt-1.5 text-ink-2" />}
      {strength !== null && threshold !== null && <MatchScale strength={strength} threshold={threshold} />}
      {m.keywordsOnly && m.keywordsOnly.length > 0 && (
        <p className="mt-3 text-[13px] leading-[18px] text-ink-2">
          This entry is tagged with {m.keywordsOnly.map((w) => `“${w}”`).join(", ")}, so it matched even though its text doesn&apos;t use that word.
        </p>
      )}
      <p className="mt-3 font-mono text-[12px] leading-[18px] text-ink-2">
        {MODE_NOTE[m.mode ?? "faq"] ?? MODE_NOTE.faq}
        {stems.size > 0 ? " Highlighted words matched your question." : ""}
      </p>
    </div>
  );
}

/** A ruled scale from 0 to 100 with the answering bar marked. */
export function MatchScale({ strength, threshold }: { strength: number; threshold: number }) {
  const s = Math.max(0, Math.min(100, strength));
  return (
    <div className="mt-4">
      <p className="flex items-baseline justify-between font-mono text-[12px] leading-4 text-ink-2">
        <span>
          Match <span className="font-medium text-ink">{s}%</span>
        </span>
        <span className="sr-only">The answering bar is {threshold}%.</span>
      </p>
      <div aria-hidden="true" className="relative mt-2 h-6">
        <span className="absolute left-0 right-0 top-[13px] h-px bg-rule-strong" />
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className="absolute top-[10px] h-[7px] w-px bg-rule-strong" style={{ left: `${i * 10}%` }} />
        ))}
        <span className="absolute left-0 top-[11px] h-[5px] rounded-xs bg-moss" style={{ width: `${s}%` }} />
        <span className="absolute top-[4px] h-[18px] w-[2px] -translate-x-1/2 bg-ink" style={{ left: `${threshold}%` }} />
        <span
          className="absolute -top-3 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] uppercase leading-3 tracking-[0.06em] text-ink-2"
          style={{ left: `${threshold}%` }}
        >
          bar {threshold}%
        </span>
      </div>
    </div>
  );
}

function NotFound({ m, onAsk, disabled }: { m: Msg; onAsk: (q: string) => void; disabled: boolean }) {
  return (
    <div data-item className="anim-rise max-w-[94%]">
      <p className="label mb-2 flex items-center gap-2 text-ember-dark">
        <span aria-hidden="true" className="h-px w-4 bg-ember" />
        Not in the FAQ
      </p>
      <div className="border-l-2 border-ember py-0.5 pl-4 text-[15px] leading-[23px]">{m.text}</div>
      <p className="anim-ticket ml-4 mt-3 inline-flex max-w-full items-center gap-2 rounded-sm border border-dashed border-ember/60 bg-ember-tint px-2.5 py-1.5 font-mono text-[12px] leading-4 text-ember-dark [animation-delay:200ms]">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" className="shrink-0">
          <path d="M1.5 4h11v2a1 1 0 0 0 0 2v2h-11V8a1 1 0 0 0 0-2Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M5 4.5v5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1 1.2" />
        </svg>
        <span>{m.example ? "Example. In a real chat this goes to the owner." : "Sent to the owner. Once they answer it, I will too."}</span>
      </p>
      {!m.example && <Suggest label="These are in the FAQ" items={COVERED} onAsk={onAsk} disabled={disabled} />}
    </div>
  );
}

function Suggest({ label, items, onAsk, disabled }: { label: string; items: string[]; onAsk: (q: string) => void; disabled: boolean }) {
  return (
    <div className="anim-fade mt-3">
      <p className="label mb-2 text-ink-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((q) => (
          <button key={q} type="button" disabled={disabled} onClick={() => onAsk(q)} className="chip whitespace-normal">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
