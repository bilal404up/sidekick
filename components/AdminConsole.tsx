"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnswerText } from "@/components/AnswerText";

export interface UnansweredItem { id: string; question: string; created_at: string }
export interface ConversationItem { id: string; created_at: string; is_sample: boolean; messages: number; unanswered: number; first_question: string | null }
export interface FaqItem { id: string; category: string; question: string; answer: string }
interface Message { id: string; role: "user" | "bot"; content: string; kind: string | null; mode: string | null; created_at: string }

type Tab = "inbox" | "conversations" | "faq";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const quoted = (s: string) => `\u201C${s}\u201D`;
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, reduceMotion() ? 0 : ms));

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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inbox");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(0);
  const [added, setAdded] = useState<Array<{ key: string; question: string }>>([]);
  const [notice, setNotice] = useState<{ text: string; at: number } | null>(null);
  const [bump, setBump] = useState(0);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  // Once the refreshed list arrives, the server count already includes what was just added.
  useEffect(() => {
    setPending(0);
  }, [faqs.length]);

  const inbox = unanswered.filter((u) => !hidden.has(u.id));
  const categories = useMemo(() => Array.from(new Set(faqs.map((f) => f.category))).sort(), [faqs]);
  const faqCount = faqs.length + pending;

  function recordAdd(question: string) {
    setPending((n) => n + 1);
    setAdded((a) => [{ key: `${Date.now()}-${a.length}`, question }, ...a].slice(0, 8));
    setBump((b) => b + 1);
    setLastAdded(question);
  }

  function onInboxDone(u: UnansweredItem, action: "add" | "dismiss") {
    setHidden((s) => new Set(s).add(u.id));
    if (action === "add") {
      recordAdd(u.question);
      setNotice({ text: `Added ${quoted(u.question)} to the FAQ. Customers get this answer from now on.`, at: Date.now() });
    } else {
      setNotice({ text: `Dismissed ${quoted(u.question)}. It won't be added to the FAQ.`, at: Date.now() });
    }
    router.refresh();
  }

  function onFaqAdded(question: string) {
    recordAdd(question);
    router.refresh();
  }

  const tabs: Array<{ key: Tab; label: string; count: number; tone: string; bumpKey: number }> = [
    { key: "inbox", label: "Inbox", count: inbox.length, tone: inbox.length ? "bg-asked-soft text-asked-dark" : "bg-canvas text-ink-muted", bumpKey: 0 },
    { key: "conversations", label: "Conversations", count: conversations.length, tone: "bg-canvas text-ink-muted", bumpKey: 0 },
    { key: "faq", label: "FAQ", count: faqCount, tone: "bg-found-soft text-found-dark", bumpKey: bump },
  ];

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    const order = tabs.map((t) => t.key);
    const i = order.indexOf(tab);
    let n: number;
    if (e.key === "ArrowRight") n = (i + 1) % order.length;
    else if (e.key === "ArrowLeft") n = (i + order.length - 1) % order.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = order.length - 1;
    else return;
    e.preventDefault();
    setTab(order[n]);
    tabRefs.current[order[n]]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Admin sections" onKeyDown={onTabKey} className="flex gap-1 overflow-x-auto border-b border-rule">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[t.key] = el;
              }}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={on}
              aria-controls={on ? `panel-${t.key}` : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[15px] font-semibold ${on ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {t.label}
              <span key={`${t.key}-${t.bumpKey}`} className={`inline-block rounded-full px-2 py-0.5 text-[12px] leading-4 ${t.tone} ${t.bumpKey ? "anim-bump" : ""}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === "inbox" && <Inbox items={inbox} categories={categories} notice={notice} faqCount={faqCount} added={added} bump={bump} onDone={onInboxDone} />}
        {tab === "conversations" && <Conversations items={conversations} />}
        {tab === "faq" && <Faqs items={faqs} categories={categories} lastAdded={lastAdded} onAdded={onFaqAdded} />}
      </div>
    </div>
  );
}

function Inbox({
  items,
  categories,
  notice,
  faqCount,
  added,
  bump,
  onDone,
}: {
  items: UnansweredItem[];
  categories: string[];
  notice: { text: string; at: number } | null;
  faqCount: number;
  added: Array<{ key: string; question: string }>;
  bump: number;
  onDone: (u: UnansweredItem, action: "add" | "dismiss") => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);
  const acted = useRef(false);

  // After a card leaves, focus the next answer field so the owner can keep going.
  useEffect(() => {
    if (!acted.current) return;
    acted.current = false;
    const next = listRef.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (next) next.focus();
    else emptyRef.current?.focus();
  }, [items.length]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div role="status" aria-live="polite">
          {notice && (
            <p key={notice.at} className="anim-rise mb-5 rounded-lg border border-rule bg-surface px-4 py-3 text-[14px] leading-5">
              {notice.text}
            </p>
          )}
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule-strong p-6">
            <h2 ref={emptyRef} tabIndex={-1} className="text-[22px] leading-7">
              Nothing waiting.
            </h2>
            <p className="mt-1.5 text-[15px] leading-[22px] text-ink-muted">When the assistant can&apos;t find an answer, the question shows up here so you can add it.</p>
          </div>
        ) : (
          <ul ref={listRef} className="space-y-4">
            {items.map((u) => (
              <InboxCard
                key={u.id}
                u={u}
                categories={categories}
                onDone={(action) => {
                  acted.current = true;
                  onDone(u, action);
                }}
              />
            ))}
          </ul>
        )}
      </div>
      <aside aria-label="FAQ summary" className="h-fit space-y-4 lg:sticky lg:top-6">
        <div className="panel p-4">
          <p className="text-[13px] leading-[18px] text-ink-muted">Entries in the FAQ</p>
          <p key={bump} className={`mt-1 inline-block text-[32px] font-semibold leading-none tracking-tight ${bump ? "anim-bump" : ""}`}>
            {faqCount}
          </p>
          <p className="mt-3 text-[13px] leading-[18px] text-ink-muted">Answers you add are used from the next question on. There is nothing to publish.</p>
        </div>
        {added.length > 0 && (
          <div className="panel p-4">
            <h2 className="text-[15px] leading-5 tracking-normal">Added this session</h2>
            <ul className="mt-2 space-y-2">
              {added.map((a) => (
                <li key={a.key} className="anim-rise flex gap-2 text-[14px] leading-5">
                  <span aria-hidden="true" className="dot mt-1.5 bg-found" />
                  {a.question}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function InboxCard({ u, categories, onDone }: { u: UnansweredItem; categories: string[]; onDone: (action: "add" | "dismiss") => void }) {
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"add" | "dismiss" | null>(null);
  const [phase, setPhase] = useState<"idle" | "added" | "leaving">("idle");
  const busy = pending !== null;

  async function act(action: "add" | "dismiss") {
    setPending(action);
    setError(null);
    const r = await api("/api/admin/unanswered", "POST", { id: u.id, action, answer, category });
    if (!r.ok) {
      setPending(null);
      setError(r.error ?? "Failed");
      return;
    }
    if (action === "add") {
      setPhase("added");
      await wait(900);
    }
    setPhase("leaving");
    await wait(220);
    onDone(action);
  }

  const success = phase !== "idle" && pending === "add";

  return (
    <li className={phase === "leaving" ? "anim-slide-out" : ""}>
      <div className={`panel p-4 transition-colors sm:p-5 ${success ? "border-found" : ""}`}>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold leading-4 text-asked-dark">
          <span aria-hidden="true" className="dot bg-asked" />
          Asked {when(u.created_at)}
        </p>
        <p className="mt-1.5 text-[17px] font-semibold leading-6">{u.question}</p>
        {success ? (
          <p className="anim-fade mt-4 flex items-center gap-2 text-[15px] font-semibold leading-[22px] text-found">
            <span aria-hidden="true" className="anim-pop grid h-6 w-6 shrink-0 place-items-center rounded-full bg-found text-white">
              <Check />
            </span>
            Added to the FAQ. Customers get this answer from now on.
          </p>
        ) : (
          <div className="mt-4">
            <label htmlFor={`a-${u.id}`} className="block text-[14px] font-semibold leading-5">
              Answer to add to the FAQ
            </label>
            <textarea
              id={`a-${u.id}`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              disabled={busy}
              className="field mt-1.5 py-2.5 leading-[22px]"
              placeholder="Write the answer customers should get"
            />
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={`c-${u.id}`} className="block text-[14px] font-semibold leading-5">
                  Category
                </label>
                <input id={`c-${u.id}`} list={`cats-${u.id}`} value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy} className="field mt-1.5 h-11 w-48" />
                <datalist id={`cats-${u.id}`}>
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <button type="button" disabled={busy || answer.trim().length < 3} onClick={() => act("add")} className="btn-found">
                {pending === "add" ? "Adding" : "Add to FAQ"}
              </button>
              <button type="button" disabled={busy} onClick={() => act("dismiss")} className="btn-quiet">
                {pending === "dismiss" ? "Dismissing" : "Dismiss"}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-[13px] leading-[18px] text-error">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

const MODE_LABEL: Record<string, string> = {
  faq: "Quoted from the FAQ",
  model: "Reworded by AI from one entry",
  "model-fallback": "Quoted from the FAQ (AI unavailable)",
};

function Conversations({ items }: { items: ConversationItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  async function open(id: string) {
    setSelected(id);
    setMessages(null);
    setError(null);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      paneRef.current?.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
    }
    try {
      const res = await fetch(`/api/admin/conversation?id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the conversation");
    }
  }

  if (items.length === 0) {
    return <p className="text-[15px] leading-[22px] text-ink-muted">No conversations yet. Ask the assistant something on the home page and it will appear here.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <ul className="panel max-h-[600px] divide-y divide-rule overflow-y-auto">
        {items.map((c) => {
          const on = selected === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                aria-pressed={on}
                className={`block w-full px-4 py-3 text-left hover:bg-canvas ${on ? "bg-canvas shadow-[inset_3px_0_0_#15181B]" : ""}`}
              >
                <span className="block truncate text-[15px] font-semibold leading-[22px]">{c.first_question ?? "(no questions)"}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 text-ink-muted">
                  <span>{when(c.created_at)}</span>
                  <span>{c.messages} messages</span>
                  {c.unanswered > 0 && <span className="rounded-full bg-asked-soft px-2 py-0.5 font-semibold text-asked-dark">{c.unanswered} not in FAQ</span>}
                  {c.is_sample && <span className="rounded-full bg-canvas px-2 py-0.5 ring-1 ring-rule">sample</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div ref={paneRef} className="panel min-h-[280px] scroll-mt-4 p-4 sm:p-5">
        {!selected && <p className="text-[15px] leading-[22px] text-ink-muted">Pick a conversation to read it.</p>}
        {selected && !messages && !error && <p className="text-[15px] leading-[22px] text-ink-muted">Loading</p>}
        {error && (
          <p role="alert" className="text-[14px] leading-5 text-error">
            {error}
          </p>
        )}
        {messages && (
          <ol className="space-y-4">
            {messages.map((m) => (
              <li key={m.id}>
                <Bubble m={m} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[15px] leading-[22px] text-white">{m.content}</p>
      </div>
    );
  }
  const unknown = m.kind === "unknown";
  const label = unknown ? "Not in the FAQ, sent to the inbox" : (m.mode && MODE_LABEL[m.mode]) || "Small talk";
  return (
    <div className="max-w-[92%]">
      <div className={`rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[15px] leading-[22px] ${unknown ? "border-[#F1D3B0] bg-asked-soft" : "border-rule bg-surface"}`}>
        {m.mode === "faq" || m.mode === "model-fallback" ? <AnswerText text={m.content} /> : <p className="whitespace-pre-line">{m.content}</p>}
      </div>
      <p className={`mt-1 flex items-center gap-1.5 pl-1 text-[12px] leading-4 ${unknown ? "text-asked-dark" : "text-ink-muted"}`}>
        <span aria-hidden="true" className={`dot ${unknown ? "bg-asked" : m.mode && MODE_LABEL[m.mode] ? "bg-found" : "bg-rule-strong"}`} />
        {label}
      </p>
    </div>
  );
}

function Faqs({ items, categories, lastAdded, onAdded }: { items: FaqItem[]; categories: string[]; lastAdded: string | null; onAdded: (question: string) => void }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [done, setDone] = useState<number | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/admin/faq", "POST", { question, answer, category });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Failed");
    const q = question;
    setDone(Date.now());
    setQuestion("");
    setAnswer("");
    onAdded(q);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this FAQ entry? The assistant will stop answering it.")) return;
    const r = await api(`/api/admin/faq?id=${id}`, "DELETE");
    if (!r.ok) return setError(r.error ?? "Failed");
    router.refresh();
  }

  const needle = filter.trim().toLowerCase();
  const shown = needle ? items.filter((i) => `${i.question} ${i.answer} ${i.category}`.toLowerCase().includes(needle)) : items;
  const groups = Array.from(new Set(shown.map((i) => i.category)));
  const newKey = lastAdded?.trim().toLowerCase() ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="mb-6 max-w-sm">
          <label htmlFor="faq-filter" className="block text-[14px] font-semibold leading-5">
            Find an entry
          </label>
          <input id="faq-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} className="field mt-1.5 h-11" placeholder="Shipping, refund, seeds" />
        </div>
        {groups.length === 0 && <p className="text-[15px] leading-[22px] text-ink-muted">No entries match {quoted(filter.trim())}.</p>}
        <div className="space-y-8">
          {groups.map((g) => {
            const list = shown.filter((i) => i.category === g);
            return (
              <section key={g}>
                <h3 className="mb-2 text-[15px] leading-5 tracking-normal">
                  {g} <span className="font-normal text-ink-muted">({list.length})</span>
                </h3>
                <ul className="panel divide-y divide-rule overflow-hidden">
                  {list.map((f) => {
                    const isNew = newKey !== null && f.question.trim().toLowerCase() === newKey;
                    return (
                      <li key={f.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${isNew ? "is-new anim-rise" : ""}`}>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold leading-[22px]">{f.question}</p>
                          <AnswerText text={f.answer} className="mt-1 text-[14px] leading-[21px] text-ink-muted" />
                        </div>
                        <button type="button" onClick={() => remove(f.id)} className="btn-quiet shrink-0 text-error">
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <form onSubmit={add} className="panel h-fit space-y-3 p-4 sm:p-5 lg:sticky lg:top-6">
        <h3 className="text-[17px] leading-6">Add an entry</h3>
        <Field id="nq" label="Question">
          <input id="nq" value={question} onChange={(e) => setQuestion(e.target.value)} className="field mt-1.5 h-11" />
        </Field>
        <Field id="na" label="Answer">
          <textarea id="na" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className="field mt-1.5 py-2.5 leading-[22px]" />
        </Field>
        <Field id="nc" label="Category">
          <input id="nc" list="faq-cats" value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1.5 h-11" />
          <datalist id="faq-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        {error && (
          <p role="alert" className="text-[13px] leading-[18px] text-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || question.trim().length < 3 || answer.trim().length < 3} className="btn-found w-full">
          {busy ? "Adding" : "Add to FAQ"}
        </button>
        <div role="status" aria-live="polite">
          {done && (
            <p key={done} className="anim-fade flex items-center gap-2 text-[14px] font-semibold leading-5 text-found">
              <span aria-hidden="true" className="anim-pop grid h-5 w-5 shrink-0 place-items-center rounded-full bg-found text-white">
                <Check />
              </span>
              Added. Customers get this answer from now on.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-semibold leading-5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
