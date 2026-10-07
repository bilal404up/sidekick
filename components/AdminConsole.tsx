"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface UnansweredItem { id: string; question: string; created_at: string }
export interface ConversationItem { id: string; created_at: string; is_sample: boolean; messages: number; unanswered: number; first_question: string | null }
export interface FaqItem { id: string; category: string; question: string; answer: string }
interface Message { id: string; role: "user" | "bot"; content: string; kind: string | null; mode: string | null; created_at: string }

type Tab = "unanswered" | "conversations" | "faq";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function api(path: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Something went wrong" };
  } catch {
    return { ok: false, error: "Could not reach the server" };
  }
}

export function AdminConsole({ unanswered, conversations, faqs }: { unanswered: UnansweredItem[]; conversations: ConversationItem[]; faqs: FaqItem[] }) {
  const [tab, setTab] = useState<Tab>("unanswered");
  const tabs: Array<[Tab, string]> = [
    ["unanswered", `Unanswered (${unanswered.length})`],
    ["conversations", `Conversations (${conversations.length})`],
    ["faq", `FAQ (${faqs.length})`],
  ];
  return (
    <div>
      <div role="tablist" aria-label="Admin sections" className="flex gap-1 border-b border-ink">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`-mb-px border border-b-0 px-4 py-2 text-[15px] font-semibold ${tab === key ? "border-ink bg-paper-raised" : "border-transparent text-ink-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="pt-6">
        {tab === "unanswered" && <Unanswered items={unanswered} />}
        {tab === "conversations" && <Conversations items={conversations} />}
        {tab === "faq" && <Faqs items={faqs} />}
      </div>
    </div>
  );
}

function Unanswered({ items }: { items: UnansweredItem[] }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="font-display text-[22px] leading-7">Nothing waiting.</p>
        <p className="mt-1 text-[15px] leading-[22px] text-ink-muted">When the assistant cannot find an answer, the question shows up here so you can add it.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((u) => (
        <UnansweredCard key={u.id} u={u} />
      ))}
    </ul>
  );
}

function UnansweredCard({ u }: { u: UnansweredItem }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(action: "add" | "dismiss") {
    setBusy(true);
    setError(null);
    const r = await api("/api/admin/unanswered", "POST", { id: u.id, action, answer, category });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Failed");
    router.refresh();
  }

  return (
    <li className="rounded-md border border-ink bg-paper-raised p-4">
      <p className="text-[17px] font-semibold leading-6">{u.question}</p>
      <p className="text-[13px] leading-[18px] text-ink-subtle">Asked {when(u.created_at)}</p>
      <label htmlFor={`a-${u.id}`} className="mt-3 block text-[14px] font-semibold">Answer to add to the FAQ</label>
      <textarea id={`a-${u.id}`} value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} className="field mt-1 py-2" placeholder="Write the answer customers should get" />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`c-${u.id}`} className="block text-[14px] font-semibold">Category</label>
          <input id={`c-${u.id}`} value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1 h-10 w-44" />
        </div>
        <button type="button" disabled={busy || answer.trim().length < 3} onClick={() => act("add")} className="btn-primary">Add to FAQ</button>
        <button type="button" disabled={busy} onClick={() => act("dismiss")} className="btn-secondary">Dismiss</button>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] leading-[18px] text-error">{error}</p>}
    </li>
  );
}

function Conversations({ items }: { items: ConversationItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(id: string) {
    setSelected(id);
    setMessages(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/conversation?id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the conversation");
    }
  }

  if (items.length === 0) return <p className="text-[15px] leading-[22px] text-ink-muted">No conversations yet. Ask the assistant something on the home page and it will appear here.</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <ul className="max-h-[560px] divide-y divide-line overflow-y-auto rounded-md border border-ink bg-paper-raised">
        {items.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => open(c.id)} aria-pressed={selected === c.id} className={`block w-full px-4 py-3 text-left hover:bg-pine-50 ${selected === c.id ? "bg-pine-50" : ""}`}>
              <span className="block truncate text-[15px] font-semibold leading-[22px]">{c.first_question ?? "(no questions)"}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-ink-subtle">
                {when(c.created_at)}
                <span>{c.messages} messages</span>
                {c.unanswered > 0 && <span className="rounded-xs bg-pink px-1.5 font-mono text-[11px] leading-4 text-ink">{c.unanswered} not in FAQ</span>}
                {c.is_sample && <span className="rounded-xs bg-pine-50 px-1.5 font-mono text-[11px] leading-4 text-pine-dark">sample</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-h-[200px] rounded-md border border-ink bg-paper-raised p-4">
        {!selected && <p className="text-[15px] leading-[22px] text-ink-muted">Pick a conversation to read it.</p>}
        {selected && !messages && !error && <p className="text-[15px] text-ink-muted">Loading</p>}
        {error && <p role="alert" className="text-[14px] text-error">{error}</p>}
        {messages && (
          <ol className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={m.role === "user" ? "text-right" : ""}>
                <p className={`inline-block max-w-[90%] rounded-md px-3 py-2 text-left text-[15px] leading-[22px] ${m.role === "user" ? "bg-pine text-white" : m.kind === "unknown" ? "border border-ink bg-pink-50" : "border border-line-strong bg-paper"}`}>{m.content}</p>
                {m.role === "bot" && m.mode && m.mode !== "none" && <span className="block font-mono text-[11px] leading-4 text-ink-subtle">{m.mode}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Faqs({ items }: { items: FaqItem[] }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/admin/faq", "POST", { question, answer, category });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Failed");
    setQuestion("");
    setAnswer("");
    router.refresh();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this FAQ entry? The assistant will stop answering it.")) return;
    const r = await api(`/api/admin/faq?id=${id}`, "DELETE");
    if (!r.ok) return setError(r.error ?? "Failed");
    router.refresh();
  }

  const groups = Array.from(new Set(items.map((i) => i.category)));
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g}>
            <h3 className="mb-2 text-[18px] leading-6">{g}</h3>
            <ul className="divide-y divide-line rounded-md border border-ink bg-paper-raised">
              {items.filter((i) => i.category === g).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-[22px]">{f.question}</p>
                    <p className="text-[14px] leading-5 text-ink-muted">{f.answer}</p>
                  </div>
                  <button type="button" onClick={() => remove(f.id)} className="shrink-0 text-[14px] text-error underline underline-offset-4">Delete</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <form onSubmit={add} className="h-fit space-y-3 rounded-md border border-ink bg-paper-raised p-4">
        <h3 className="text-[18px] leading-6">Add an entry</h3>
        <div>
          <label htmlFor="nq" className="block text-[14px] font-semibold">Question</label>
          <input id="nq" value={question} onChange={(e) => setQuestion(e.target.value)} className="field mt-1 h-10" />
        </div>
        <div>
          <label htmlFor="na" className="block text-[14px] font-semibold">Answer</label>
          <textarea id="na" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className="field mt-1 py-2" />
        </div>
        <div>
          <label htmlFor="nc" className="block text-[14px] font-semibold">Category</label>
          <input id="nc" value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1 h-10" />
        </div>
        {error && <p role="alert" className="text-[13px] leading-[18px] text-error">{error}</p>}
        <button type="submit" disabled={busy || question.trim().length < 3 || answer.trim().length < 3} className="btn-primary w-full">Add entry</button>
      </form>
    </div>
  );
}
