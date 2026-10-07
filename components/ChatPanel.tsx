"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  id: number;
  role: "user" | "bot" | "error";
  text: string;
  kind?: "answer" | "unknown" | "smalltalk";
  mode?: "faq" | "model" | "model-fallback" | "none";
  source?: string;
}

const CHIPS: Array<{ label: string; note?: string }> = [
  { label: "How much is shipping?" },
  { label: "Can I return a plant that died?" },
  { label: "How often should I water succulents?" },
  { label: "Can you recommend a laptop?", note: "Not in the FAQ. Watch what it does." },
];

const MAX = 500;

export function ChatPanel({ llmOn, className = "" }: { llmOn: boolean; className?: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: "bot",
      kind: "smalltalk",
      text: "Hi, I'm the Fernbrook shop assistant. I answer only from the shop's help pages. Ask about shipping, returns, orders or plant care.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        const r = data.reply;
        setMessages((m) => [
          ...m,
          { id: idRef.current++, role: "bot", text: r.text, kind: r.kind, mode: r.mode, source: r.sources?.[0]?.question },
        ]);
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
    <section aria-label="Chat with the shop assistant" className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-ink bg-paper-raised ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-ink bg-pine px-4 py-3 text-white">
        <div>
          <h2 className="font-display text-[17px] leading-6">Sidekick</h2>
          <p className="text-[13px] leading-[18px] text-pine-100">Fernbrook Garden Supply help</p>
        </div>
        <span className="rounded-xs border border-pine-100 px-2 py-0.5 font-mono text-[11px] leading-4 text-pine-100">
          {llmOn ? "AI model on" : "FAQ lookup"}
        </span>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        {busy && (
          <div className="flex items-center gap-1 pl-1" aria-label="The assistant is typing">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-subtle" style={{ animation: `dot 1.2s ${i * 0.15}s infinite` }} />
            ))}
          </div>
        )}
        {showChips && (
          <div className="flex flex-col items-start gap-2 pt-1">
            {CHIPS.map((c) => (
              <button key={c.label} type="button" onClick={() => send(c.label)} className="rounded-sm border border-ink bg-paper-raised px-3 py-1.5 text-left text-[14px] leading-5 hover:bg-pine-50">
                {c.label}
                {c.note && <span className="block text-[12px] leading-4 text-ink-subtle">{c.note}</span>}
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
        className="border-t border-ink bg-paper-raised p-3"
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
            className="field h-10"
          />
          <button type="submit" disabled={busy || input.trim().length === 0} className="btn-primary">
            Send
          </button>
        </div>
        <p className="mt-2 text-[12px] leading-4 text-ink-subtle">
          {input.length > 400 ? `${MAX - input.length} characters left. ` : ""}
          Chats are saved so the shop owner can review them. Do not share personal details. Demo, sample data.
        </p>
      </form>
    </section>
  );
}

function Bubble({ m }: { m: Msg }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-md rounded-br-xs bg-pine px-3 py-2 text-[15px] leading-[22px] text-white">{m.text}</p>
      </div>
    );
  }
  if (m.role === "error") {
    return (
      <p role="alert" className="rounded-sm border border-error bg-paper-raised px-3 py-2 text-[14px] leading-5 text-error">
        {m.text}
      </p>
    );
  }
  const unknown = m.kind === "unknown";
  return (
    <div className="flex max-w-[92%] flex-col items-start gap-1">
      <p className={`rounded-md rounded-bl-xs border px-3 py-2 text-[15px] leading-[22px] ${unknown ? "border-ink bg-pink-50" : "border-line-strong bg-paper-raised"}`}>{m.text}</p>
      {unknown && <span className="rounded-xs bg-pink px-1.5 py-0.5 font-mono text-[11px] leading-4 text-ink">Not in the help pages</span>}
      {m.kind === "answer" && m.source && (
        <span className="max-w-full truncate rounded-xs bg-pine-50 px-1.5 py-0.5 font-mono text-[11px] leading-4 text-pine-dark">
          {m.mode === "model" ? "Written by the AI model from: " : "From the FAQ: "}
          {m.source}
        </span>
      )}
    </div>
  );
}
