"use client";

import { useEffect, useRef, useState } from "react";
import type { Reply } from "@/lib/engine/respond";
import { AnswerText } from "@/components/AnswerText";

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
const GREETING = "Hi, I'm the Fernbrook shop assistant. I answer from the shop's FAQ, and I'll tell you when something isn't in it.";
const MODE_NOTE: Record<string, string> = {
  faq: "Quoted word for word from the FAQ.",
  model: "Reworded by the AI model from this entry only.",
  "model-fallback": "The AI model didn't respond, so this is the entry word for word.",
};

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
  onEvent,
}: {
  llmOn: boolean;
  className?: string;
  variant?: "page" | "widget";
  script?: ScriptStep[];
  onEvent?: (e: ChatEvent) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, role: "bot", kind: "smalltalk", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [scriptDone, setScriptDone] = useState(!script?.length);
  const idRef = useRef(1);
  const stopRef = useRef(false);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const compact = variant === "widget";

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
    at(() => setMessages((m) => [...m, { id: idRef.current++, role: "note", text: "Example run, played automatically. Nothing here is saved." }]));
    for (const s of script) {
      t += 500;
      at(() => setMessages((m) => [...m, { id: idRef.current++, role: "user", text: s.question, example: true }]));
      t += 450;
      at(() => setTyping(true));
      t += 900;
      at(() => {
        setTyping(false);
        const msg = toMsg(s.reply, idRef.current++, true);
        setMessages((m) => [...m, msg]);
        emit(msg, s.question);
      });
      t += 1600;
    }
    at(() => {
      setMessages((m) => [...m, { id: idRef.current++, role: "note", text: "Your turn." }]);
      setScriptDone(true);
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    stopRef.current = true;
    setTyping(false);
    setScriptDone(true);
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

  const showChips = scriptDone && !messages.some((m) => m.role === "user" && !m.example);

  return (
    <section
      aria-label="Chat with the shop assistant"
      className={`flex min-h-0 flex-col overflow-hidden bg-surface ${compact ? "" : "rounded-xl border border-rule shadow-panel"} ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-found text-[13px] font-bold text-white">
            F
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] leading-5 tracking-normal">Fernbrook Garden Supply</h2>
            <p className="truncate text-[12px] leading-4 text-ink-muted">Answers from the shop&apos;s FAQ</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[12px] font-semibold leading-4 text-ink-muted ring-1 ring-rule">
          {llmOn ? "AI rewording on" : "FAQ only"}
        </span>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <Entry key={m.id} m={m} onAsk={send} disabled={busy} />
        ))}
        {(busy || typing) && (
          <div className="flex items-center gap-2 pl-1" aria-label="The assistant is typing">
            <span aria-hidden="true" className="typing inline-flex gap-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            <span className="text-[13px] leading-[18px] text-ink-muted">Checking the FAQ</span>
          </div>
        )}
        {showChips && (
          <div className="anim-fade">
            <p className="mb-2 pl-1 text-[12px] leading-4 text-ink-muted">Try one</p>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button key={c.label} type="button" onClick={() => send(c.label)} disabled={busy} className="chip">
                  {c.label}
                  {c.note && <span className="ml-2 text-[12px] text-ink-muted">{c.note}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-rule p-3"
      >
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
            className="field h-11"
          />
          <button type="submit" disabled={busy || input.trim().length === 0} className="btn-primary h-11 shrink-0">
            Send
          </button>
        </div>
        <p className="mt-2 text-[12px] leading-4 text-ink-subtle">
          {input.length > 400 ? `${MAX - input.length} characters left. ` : ""}
          Chats are saved so the shop owner can review them. Please don&apos;t share personal details. Demo with sample data.
        </p>
      </form>
    </section>
  );
}

function Entry({ m, onAsk, disabled }: { m: Msg; onAsk: (q: string) => void; disabled: boolean }) {
  if (m.role === "note") return <p className="anim-fade py-1 text-center text-[12px] font-semibold leading-4 text-ink-subtle">{m.text}</p>;
  if (m.role === "user") {
    return (
      <div className="anim-rise flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[15px] leading-[22px] text-white">{m.text}</p>
      </div>
    );
  }
  if (m.role === "error") {
    return (
      <p role="alert" className="rounded-lg border border-error/40 bg-surface px-3 py-2 text-[14px] leading-5 text-error">
        {m.text}
      </p>
    );
  }
  if (m.kind === "answer") return <Answer m={m} onAsk={onAsk} disabled={disabled} />;
  if (m.kind === "unknown") return <NotFound m={m} onAsk={onAsk} disabled={disabled} />;
  return <p className="anim-rise max-w-[94%] rounded-2xl rounded-bl-md border border-rule bg-surface px-3.5 py-2.5 text-[15px] leading-[22px]">{m.text}</p>;
}

function Answer({ m, onAsk, disabled }: { m: Msg; onAsk: (q: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const verbatim = m.mode !== "model";
  const stems = new Set(m.stems ?? []);
  const entryText = verbatim ? m.text : m.original;
  const strength = m.strength !== undefined ? Math.round(m.strength * 100) : null;
  const threshold = m.threshold !== undefined ? Math.round(m.threshold * 100) : null;

  return (
    <div data-msg={m.id} className="anim-rise max-w-[94%]">
      {m.headline && <p className="mb-1.5 pl-1 text-[13px] font-semibold leading-[18px] text-found">{m.headline}</p>}
      <div data-bubble className="rounded-2xl rounded-bl-md border border-rule bg-surface px-3.5 pt-2.5 text-[15px] leading-[22px] shadow-[0_1px_2px_rgba(21,24,27,0.05)]">
        {verbatim ? <AnswerText text={m.text} /> : <p className="whitespace-pre-line">{m.text}</p>}
        {m.sourceQ ? (
          <div className="mt-2.5 border-t border-rule">
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-11 w-full items-center gap-2 text-left text-[13px] leading-[18px]">
              <span data-anchor aria-hidden="true" className="dot bg-found" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-found">From the FAQ: </span>
                <span className="text-ink-muted">{m.sourceQ}</span>
              </span>
              <span className="shrink-0 font-semibold text-ink">{open ? "Hide" : "Check it"}</span>
            </button>
            {open && (
              <div className="anim-fade mb-3 rounded-lg bg-canvas p-3 text-[14px] leading-[21px]">
                <AnswerText text={m.sourceQ} stems={stems} className="font-semibold" />
                {entryText && <AnswerText text={entryText} stems={stems} className="mt-1 text-ink-muted" />}
                {strength !== null && threshold !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[12px] leading-4 text-ink-muted">
                      <span>Match strength {strength}%</span>
                      <span>Needs {threshold}%</span>
                    </div>
                    <div aria-hidden="true" className="relative mt-1.5 h-1.5 rounded-full bg-rule">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-found" style={{ width: `${strength}%` }} />
                      <span className="absolute -top-1 h-3.5 w-0.5 bg-ink" style={{ left: `${threshold}%` }} />
                    </div>
                  </div>
                )}
                {m.keywordsOnly && m.keywordsOnly.length > 0 && (
                  <p className="mt-3 text-[12px] leading-4 text-ink-muted">
                    This entry is tagged with {m.keywordsOnly.map((w) => `“${w}”`).join(", ")}, so it matched even though its text doesn&apos;t use that word.
                  </p>
                )}
                <p className="mt-3 text-[12px] leading-4 text-ink-muted">
                  {MODE_NOTE[m.mode ?? "faq"] ?? MODE_NOTE.faq}
                  {stems.size > 0 ? " Highlighted words matched your question." : ""}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="pb-2.5" />
        )}
      </div>
      {(m.partial || m.note) && (
        <p className="anim-fade mt-2 rounded-lg bg-asked-soft px-3 py-2 text-[13px] leading-[19px] text-asked-dark">
          {m.note ?? "Part of your question isn't covered by this entry."}
        </p>
      )}
      {m.related && m.related.length > 0 && !m.example && <Suggest label="Also in the FAQ" items={m.related} onAsk={onAsk} disabled={disabled} />}
    </div>
  );
}

function NotFound({ m, onAsk, disabled }: { m: Msg; onAsk: (q: string) => void; disabled: boolean }) {
  return (
    <div className="anim-rise max-w-[94%]">
      <p className="mb-1.5 flex items-center gap-1.5 pl-1 text-[13px] font-semibold leading-[18px] text-asked-dark">
        <span aria-hidden="true" className="dot bg-asked" />
        Not in the FAQ
      </p>
      <div className="rounded-2xl rounded-bl-md border border-[#F1D3B0] bg-asked-soft px-3.5 py-2.5 text-[15px] leading-[22px]">{m.text}</div>
      <p className="anim-fade mt-2 flex items-start gap-2 pl-1 text-[13px] leading-[18px] text-ink-muted">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0">
          <circle cx="7" cy="4.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 12.5c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span>{m.example ? "In a real chat this goes to the shop owner's inbox." : "Sent to the shop owner's inbox. Once they add an answer, I'll know it."}</span>
      </p>
      {!m.example && <Suggest label="These are in the FAQ" items={COVERED} onAsk={onAsk} disabled={disabled} />}
    </div>
  );
}

function Suggest({ label, items, onAsk, disabled }: { label: string; items: string[]; onAsk: (q: string) => void; disabled: boolean }) {
  return (
    <div className="anim-fade mt-3">
      <p className="mb-1.5 pl-1 text-[12px] leading-4 text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((q) => (
          <button key={q} type="button" disabled={disabled} onClick={() => onAsk(q)} className="chip">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
