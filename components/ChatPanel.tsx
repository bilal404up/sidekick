"use client";

import { useEffect, useRef, useState } from "react";
import { IndexCard } from "@/components/IndexCard";
import { TypedAnswer } from "@/components/TypedAnswer";
import { cardNumber, FILE_EVENT, type FileEventDetail } from "@/lib/cardCode";

type Kind = "answer" | "unknown" | "smalltalk";
type Mode = "faq" | "model" | "model-fallback" | "none";

interface Msg {
  id: number;
  role: "user" | "bot" | "error";
  text: string;
  kind?: Kind;
  mode?: Mode;
  source?: string;
  sourceAnswer?: string;
  headline?: string;
  related?: string[];
  partial?: boolean;
  note?: string;
}

const CHIPS: Array<{ label: string; note?: string }> = [
  { label: "How much is shipping?" },
  { label: "Can I return a plant that died?" },
  { label: "How often should I water succulents?" },
  { label: "Can you recommend a laptop?", note: "Not on file. Watch what it does." },
];
const ON_FILE = CHIPS.filter((c) => !c.note).map((c) => c.label);

const MAX = 500;

const GREETING =
  "Hello, I'm the Fernbrook help desk. I only answer from the shop's help file, and I'll tell you when something isn't in it. Ask about shipping, returns, orders or plant care.";

/** Fallback framing for servers that do not send a headline yet. */
const FOUND = ["Found it in the help file.", "This one is on file.", "Here is the card for that."];

const FOOTNOTE: Record<string, string> = {
  faq: "Typed exactly as it appears in the help file.",
  model: "Reworded by the AI model from this card only.",
  "model-fallback": "The AI model did not respond, so this is the card word for word.",
};

function announce(kind: Kind | undefined, source: string | undefined) {
  if (typeof window === "undefined") return;
  let detail: FileEventDetail | null = null;
  if (kind === "answer" && source) detail = { kind: "answer", code: cardNumber(source) };
  else if (kind === "unknown") detail = { kind: "unknown" };
  if (detail) window.dispatchEvent(new CustomEvent<FileEventDetail>(FILE_EVENT, { detail }));
}

function readRelated(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && typeof (x as { question?: unknown }).question === "string" ? (x as { question: string }).question : null))
    .filter((x): x is string => Boolean(x))
    .slice(0, 3);
  return list.length ? list : undefined;
}

export function ChatPanel({ llmOn, className = "", variant = "page" }: { llmOn: boolean; className?: string; variant?: "page" | "widget" }) {
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, role: "bot", kind: "smalltalk", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const compact = variant === "widget";

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
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
        const r = data.reply ?? {};
        const src = r.sources?.[0];
        const msg: Msg = {
          id: idRef.current++,
          role: "bot",
          text: r.text,
          kind: r.kind,
          mode: r.mode,
          source: typeof src?.question === "string" ? src.question : undefined,
          sourceAnswer: typeof r.card?.answer === "string" ? r.card.answer : typeof src?.answer === "string" ? src.answer : undefined,
          headline: typeof r.headline === "string" ? r.headline : undefined,
          related: readRelated(r.related),
          partial: r.coverage === "partial",
          note: typeof r.note === "string" ? r.note : undefined,
        };
        setMessages((m) => [...m, msg]);
        announce(msg.kind, msg.source);
      }
    } catch {
      setMessages((m) => [...m, { id: idRef.current++, role: "error", text: "Could not reach the server. Check your connection and try again." }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const showChips = messages.length <= 1;

  return (
    <section aria-label="Chat with the shop assistant" className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-cabinet-line bg-kraft shadow-drawer ${className}`}>
      <header className={`on-cabinet border-b-4 border-cabinet-raised bg-cabinet text-card ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="label-holder min-w-0">
            <h2 className="font-display text-[18px] leading-6 text-card">Sidekick</h2>
            <p className="truncate text-[13px] leading-[18px] text-card-dim">Fernbrook Garden Supply help</p>
          </div>
          <span className="shrink-0 rounded-sm border border-brass px-2 py-1 font-card text-[12px] leading-4 text-brass">{llmOn ? "AI model on" : "FAQ lookup"}</span>
        </div>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className={`drawer-inside min-h-0 flex-1 space-y-5 overflow-y-auto py-4 ${compact ? "px-3" : "px-3 sm:px-4"}`}>
        {messages.map((m, i) => (
          <Entry key={m.id} m={m} asked={askedBefore(messages, i)} onAsk={send} disabled={busy} />
        ))}
        {busy && (
          <div className="flex items-center gap-3 pl-1" aria-label="The assistant is typing">
            <span aria-hidden="true" className="riffle">
              <span />
              <span />
              <span />
            </span>
            <span className="text-[14px] leading-5 text-ink-muted">Looking in the file</span>
          </div>
        )}
        {showChips && (
          <div className="flex flex-col items-start gap-2 pt-1">
            {CHIPS.map((c) => (
              <button key={c.label} type="button" onClick={() => send(c.label)} disabled={busy} className="chip">
                {c.label}
                {c.note && <span className="mt-0.5 block text-[12px] leading-4 text-ink-muted">{c.note}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-card-edge bg-card p-3"
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
            Ask
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

function askedBefore(messages: Msg[], index: number): string | undefined {
  for (let i = index - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].text;
  return undefined;
}

function Entry({ m, asked, onAsk, disabled }: { m: Msg; asked?: string; onAsk: (q: string) => void; disabled: boolean }) {
  if (m.role === "user") {
    return (
      <div className="anim-request flex justify-end">
        <p className="request-slip max-w-[85%]">{m.text}</p>
      </div>
    );
  }
  if (m.role === "error") {
    return (
      <p role="alert" className="rounded-md border border-error bg-card px-3 py-2 text-[14px] leading-5 text-error">
        {m.text}
      </p>
    );
  }
  if (m.kind === "answer") return <AnswerCard m={m} onAsk={onAsk} disabled={disabled} />;
  if (m.kind === "unknown") return <UnknownCard m={m} asked={asked} onAsk={onAsk} disabled={disabled} />;
  return <p className="anim-card-pull max-w-[92%] rounded-md border border-card-edge bg-card px-3 py-2.5 text-[15px] leading-[22px] text-ink">{m.text}</p>;
}

function AnswerCard({ m, onAsk, disabled }: { m: Msg; onAsk: (q: string) => void; disabled: boolean }) {
  const code = m.source ? cardNumber(m.source) : null;
  const verbatim = m.mode !== "model";
  const lead =
    m.headline ??
    (m.partial ? "The help file covers part of this." : m.mode === "model" ? "Here it is in plain words, taken from this card only." : FOUND[code ? Number(code.charAt(3)) % FOUND.length : 0]);

  return (
    <div className="space-y-2">
      <p className="anim-card-pull pl-1 text-[15px] leading-[22px] text-ink">{lead}</p>
      <IndexCard animate tab={code ? `No. ${code}` : "On file"} title={m.source} stamp="On file" stampTone="file" footer={FOOTNOTE[m.mode ?? "faq"] ?? FOOTNOTE.faq}>
        <span className="sr-only">On file. </span>
        {verbatim ? <TypedAnswer text={m.text} /> : <p className="whitespace-pre-line text-[15px] leading-[22px] text-ink">{m.text}</p>}
        {!verbatim && m.sourceAnswer && (
          <details className="mt-[22px]">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-[14px] font-bold text-ink underline underline-offset-4">Show the original card</summary>
            <TypedAnswer text={m.sourceAnswer} className="mt-1" />
          </details>
        )}
      </IndexCard>
      {(m.partial || m.note) && (
        <p className="anim-slip ml-4 rounded-md border border-dashed border-ink-subtle bg-card px-3 py-2 text-[14px] leading-5 text-ink">
          {m.note ?? "Part of your question isn't on this card, so it may not answer all of it."}
        </p>
      )}
      {m.related && <Related items={m.related} label="Also on file" onAsk={onAsk} disabled={disabled} late={false} />}
    </div>
  );
}

function UnknownCard({ m, asked, onAsk, disabled }: { m: Msg; asked?: string; onAsk: (q: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-3">
      <div>
        <IndexCard
          animate
          className="z-[1]"
          tab="No card for this"
          title={asked ? `\u201C${asked}\u201D` : undefined}
          titleTone="quiet"
          stamp="Not on file"
          stampTone="stamp"
          stampSize="lg"
        >
          <span className="sr-only">Not on file. </span>
          <p className="text-[15px] leading-[22px] text-ink">{m.text}</p>
        </IndexCard>
        <div className="carbon-slip anim-slip">
          <TrayGlyph />
          <p>
            <span className="font-bold">Carbon copy filed in the owner&apos;s tray.</span> When the owner writes this card, I&apos;ll be able to answer it.
          </p>
        </div>
      </div>
      <Related items={ON_FILE} label="These are on file" onAsk={onAsk} disabled={disabled} late />
    </div>
  );
}

function Related({ items, label, onAsk, disabled, late }: { items: string[]; label: string; onAsk: (q: string) => void; disabled: boolean; late: boolean }) {
  return (
    <div className={late ? "anim-slip-late" : "anim-slip"}>
      <p className="mb-1.5 pl-1 text-[13px] leading-[18px] text-ink-muted">{label}</p>
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

function TrayGlyph() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-ink">
      <path d="M2 11l3-8h12l3 8v6H2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M2 11h5l1.5 2.5h5L15 11h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 6.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
