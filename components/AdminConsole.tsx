"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IndexCard, Stamp } from "@/components/IndexCard";
import { TypedAnswer } from "@/components/TypedAnswer";
import { cardNumber } from "@/lib/cardCode";

export interface UnansweredItem { id: string; question: string; created_at: string }
export interface ConversationItem { id: string; created_at: string; is_sample: boolean; messages: number; unanswered: number; first_question: string | null }
export interface FaqItem { id: string; category: string; question: string; answer: string }
interface Message { id: string; role: "user" | "bot"; content: string; kind: string | null; mode: string | null; created_at: string }

type Tab = "unanswered" | "conversations" | "faq";
interface Filed { id: string; question: string; code: string }
type Notice = { kind: "filed"; question: string; code: string; at: number } | { kind: "dismissed"; question: string; at: number };

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
  const [tab, setTab] = useState<Tab>("unanswered");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [pendingFiled, setPendingFiled] = useState(0);
  const [filed, setFiled] = useState<Filed[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pulse, setPulse] = useState(0);
  const [bump, setBump] = useState({ unanswered: 0, faq: 0 });
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  // Once the refreshed FAQ list arrives, the server count already includes what was just filed.
  useEffect(() => {
    setPendingFiled(0);
  }, [faqs.length]);

  const visible = unanswered.filter((u) => !hidden.has(u.id));
  const categories = useMemo(() => Array.from(new Set(faqs.map((f) => f.category))).sort(), [faqs]);
  const faqCount = faqs.length + pendingFiled;

  function hide(id: string) {
    setHidden((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });
  }

  function recordFiling(question: string, id: string) {
    const code = cardNumber(question);
    setPendingFiled((n) => n + 1);
    setFiled((f) => [{ id, question, code }, ...f].slice(0, 8));
    setPulse((p) => p + 1);
    setLastAdded(question);
    return code;
  }

  function handleFiled(u: UnansweredItem) {
    hide(u.id);
    const code = recordFiling(u.question, u.id);
    setNotice({ kind: "filed", question: u.question, code, at: Date.now() });
    setBump((b) => ({ unanswered: b.unanswered + 1, faq: b.faq + 1 }));
    router.refresh();
  }

  function handleDismissed(u: UnansweredItem) {
    hide(u.id);
    setNotice({ kind: "dismissed", question: u.question, at: Date.now() });
    setBump((b) => ({ ...b, unanswered: b.unanswered + 1 }));
    router.refresh();
  }

  function handleAdded(question: string) {
    recordFiling(question, `new-${Date.now()}`);
    setBump((b) => ({ ...b, faq: b.faq + 1 }));
    router.refresh();
  }

  const tabs: Array<{ key: Tab; label: string; count: number; bumpKey: number; tone: string }> = [
    { key: "unanswered", label: "Unanswered", count: visible.length, bumpKey: bump.unanswered, tone: visible.length > 0 ? "bg-stamp text-card" : "bg-kraft text-ink" },
    { key: "conversations", label: "Conversations", count: conversations.length, bumpKey: 0, tone: "bg-kraft text-ink" },
    { key: "faq", label: "FAQ", count: faqCount, bumpKey: bump.faq, tone: "bg-file text-card" },
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
      <div role="tablist" aria-label="Admin sections" onKeyDown={onTabKey} className="flex flex-wrap items-end gap-1.5 border-b border-ink-subtle">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[t.key] = el;
              }}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={active ? `panel-${t.key}` : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 rounded-t-md border border-b-0 px-4 text-[15px] font-bold ${
                active ? "border-ink-subtle bg-card text-ink" : "border-transparent bg-kraft-deep text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              <span key={`${t.key}-${t.bumpKey}`} className={`count rounded-xs px-1.5 font-card text-[13px] leading-5 ${t.tone} ${t.bumpKey > 0 ? "anim-count-bump" : ""}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-8">
        {tab === "unanswered" && (
          <Unanswered
            items={visible}
            categories={categories}
            notice={notice}
            faqCount={faqCount}
            filed={filed}
            pulse={pulse}
            onFiled={handleFiled}
            onDismissed={handleDismissed}
          />
        )}
        {tab === "conversations" && <Conversations items={conversations} />}
        {tab === "faq" && <Faqs items={faqs} categories={categories} lastAdded={lastAdded} onAdded={handleAdded} />}
      </div>
    </div>
  );
}

/* ---------- Unanswered: the tray ---------- */

function Unanswered({
  items,
  categories,
  notice,
  faqCount,
  filed,
  pulse,
  onFiled,
  onDismissed,
}: {
  items: UnansweredItem[];
  categories: string[];
  notice: Notice | null;
  faqCount: number;
  filed: Filed[];
  pulse: number;
  onFiled: (u: UnansweredItem) => void;
  onDismissed: (u: UnansweredItem) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);
  const acted = useRef(false);

  // After a card leaves the tray, move focus to the next answer field so the owner can keep going.
  useEffect(() => {
    if (!acted.current) return;
    acted.current = false;
    const next = listRef.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (next) next.focus();
    else emptyRef.current?.focus();
  }, [items.length]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div role="status" aria-live="polite">
          {notice && <NoticeSlip key={notice.at} notice={notice} />}
        </div>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-ink-subtle p-6">
            <h2 ref={emptyRef} tabIndex={-1} className="text-[24px] leading-[30px]">
              The tray is empty.
            </h2>
            <p className="mt-2 max-w-[52ch] text-[15px] leading-[22px] text-ink-muted">
              When the assistant can&apos;t find a card for a question, the question lands here so you can write the answer.
            </p>
          </div>
        ) : (
          <ul ref={listRef} className="space-y-9">
            {items.map((u) => (
              <UnansweredCard
                key={u.id}
                u={u}
                categories={categories}
                onFiled={() => {
                  acted.current = true;
                  onFiled(u);
                }}
                onDismissed={() => {
                  acted.current = true;
                  onDismissed(u);
                }}
              />
            ))}
          </ul>
        )}
      </div>
      <FaqDrawer count={faqCount} filed={filed} pulse={pulse} />
    </div>
  );
}

function NoticeSlip({ notice }: { notice: Notice }) {
  return (
    <div className="anim-receipt-in mb-8 flex items-start gap-3 rounded-md border border-card-edge border-t-brass-dark bg-card px-4 py-3 text-[15px] leading-[22px] text-ink [border-top-style:dashed] [border-top-width:2px]">
      {notice.kind === "filed" ? (
        <>
          <span aria-hidden="true" className="legend-key mt-0.5 !bg-transparent">
            <span className="stamp stamp-mini text-file">Filed</span>
          </span>
          <p>
            Filed as card <span className="font-card">No. {notice.code}</span>. The assistant now answers {quoted(notice.question)}.
          </p>
        </>
      ) : (
        <p>Dismissed {quoted(notice.question)}. It won&apos;t be added to the FAQ.</p>
      )}
    </div>
  );
}

type Phase = "idle" | "stamped" | "leaving" | "dismissing";

function UnansweredCard({ u, categories, onFiled, onDismissed }: { u: UnansweredItem; categories: string[]; onFiled: () => void; onDismissed: () => void }) {
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"add" | "dismiss" | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const code = cardNumber(u.question);
  const filed = phase === "stamped" || phase === "leaving";
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
      setPhase("stamped");
      await wait(420);
      setPhase("leaving");
      await wait(280);
      onFiled();
    } else {
      setPhase("dismissing");
      await wait(200);
      onDismissed();
    }
  }

  const motion = phase === "leaving" ? "anim-file-away" : phase === "dismissing" ? "anim-dismiss-away" : "";

  return (
    <li className={`relative ${motion}`}>
      <IndexCard tab={filed ? `No. ${code}` : `Asked ${when(u.created_at)}`} title={<span className="block pr-36 font-sans text-[17px] font-bold leading-[22px]">{quoted(u.question)}</span>}>
        <label htmlFor={`a-${u.id}`} className="block text-[14px] font-bold leading-[22px] text-ink">
          Answer to add to the FAQ
        </label>
        <textarea
          id={`a-${u.id}`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          disabled={busy}
          className="ruled-field mt-1"
          placeholder="Write the answer customers should get"
        />
        <p className="mt-1 text-[13px] leading-[22px] text-ink-subtle">This becomes the card the assistant answers from.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`c-${u.id}`} className="block text-[14px] font-bold leading-[22px] text-ink">
              Category
            </label>
            <input id={`c-${u.id}`} list={`cats-${u.id}`} value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy} className="field mt-1 h-11 w-48" />
            <datalist id={`cats-${u.id}`}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <button type="button" disabled={busy || answer.trim().length < 3} onClick={() => act("add")} className="btn-primary">
            {pending === "add" && phase === "idle" ? "Filing" : "File this answer"}
          </button>
          <button type="button" disabled={busy} onClick={() => act("dismiss")} className="btn-secondary">
            {pending === "dismiss" ? "Dismissing" : "Dismiss"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-[13px] leading-[18px] text-error">
            {error}
          </p>
        )}
      </IndexCard>
      <Stamp key={filed ? "filed" : "open"} tone={filed ? "file" : "stamp"} size="lg" className={`absolute right-3 top-[37px] ${filed ? "anim-stamp-now" : ""}`}>
        {filed ? "Filed" : "Not on file"}
      </Stamp>
    </li>
  );
}

function FaqDrawer({ count, filed, pulse }: { count: number; filed: Filed[]; pulse: number }) {
  const [lift, setLift] = useState(false);
  const seen = useRef(pulse);

  useEffect(() => {
    if (pulse === seen.current) return;
    seen.current = pulse;
    setLift(true);
    const t = setTimeout(() => setLift(false), 1200);
    return () => clearTimeout(t);
  }, [pulse]);

  return (
    <aside aria-label="FAQ drawer" className="h-fit lg:sticky lg:top-6">
      <div aria-hidden="true" className={`drawer h-auto gap-3 py-5 ${lift ? "is-pulled" : ""}`}>
        <span className="drawer-label px-3 py-1.5 text-[13px] leading-4">
          <span className="block">FAQ drawer</span>
          <span className="block">{count} cards</span>
        </span>
        <span className="drawer-pull h-2 w-10" />
      </div>
      <p className="sr-only">The FAQ has {count} cards.</p>
      <h2 className="mt-6 text-[18px] leading-6">Filed this session</h2>
      {filed.length === 0 ? (
        <p className="mt-1 text-[14px] leading-5 text-ink-muted">Answers you file go straight into the drawer. The assistant uses them on the very next question.</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {filed.map((f) => (
            <li key={f.id} className="anim-filed-in flex gap-2 rounded-md border border-card-edge bg-card px-3 py-2 text-[14px] leading-5 text-ink">
              <span className="shrink-0 font-card text-ink-subtle">No. {f.code}</span>
              <span className="min-w-0 break-words">{f.question}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

/* ---------- Conversations ---------- */

const MODE_LABEL: Record<string, string> = {
  faq: "Typed from the help file",
  model: "Reworded by the AI model from one card",
  "model-fallback": "Typed from the help file (AI model unavailable)",
};

function botLabel(m: Message): string {
  if (m.kind === "unknown") return "Not on file. Question saved to the tray.";
  if (m.mode && MODE_LABEL[m.mode]) return MODE_LABEL[m.mode];
  return "Small talk";
}

function Conversations({ items }: { items: ConversationItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  async function open(id: string) {
    setSelected(id);
    setMessages(null);
    setError(null);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
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
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <ul className="max-h-[620px] divide-y divide-card-edge overflow-y-auto rounded-md border border-ink-subtle bg-card">
        {items.map((c) => {
          const active = selected === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                aria-pressed={active}
                className={`block w-full px-4 py-3 text-left hover:bg-kraft/50 ${active ? "bg-kraft/60 shadow-[inset_4px_0_0_#C9A35B]" : ""}`}
              >
                <span className="block truncate text-[15px] font-bold leading-[22px] text-ink">{c.first_question ?? "(no questions)"}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-ink-muted">
                  <span>{when(c.created_at)}</span>
                  <span>{c.messages} messages</span>
                  {c.unanswered > 0 && <span className="rounded-xs bg-stamp px-1.5 font-card text-[12px] leading-4 text-card">{c.unanswered} not on file</span>}
                  {c.is_sample && <span className="rounded-xs bg-kraft-deep px-1.5 font-card text-[12px] leading-4 text-ink">sample</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div ref={paneRef} className="drawer-inside min-h-[260px] scroll-mt-4 rounded-md border border-ink-subtle p-4 sm:p-5">
        {!selected && <p className="text-[15px] leading-[22px] text-ink-muted">Pick a conversation to read it.</p>}
        {selected && !messages && !error && (
          <p className="flex items-center gap-3 text-[15px] leading-[22px] text-ink-muted">
            <span aria-hidden="true" className="riffle">
              <span />
              <span />
              <span />
            </span>
            Loading
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-error bg-card px-3 py-2 text-[14px] leading-5 text-error">
            {error}
          </p>
        )}
        {messages && (
          <ol className="space-y-5">
            {messages.map((m) => (
              <li key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? <p className="request-slip max-w-[85%]">{m.content}</p> : <BotLine m={m} />}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function BotLine({ m }: { m: Message }) {
  const typed = m.mode === "faq" || m.mode === "model-fallback";
  return (
    <div className="relative max-w-[92%] rounded-md border border-card-edge bg-card px-3 py-2.5 shadow-[0_1px_0_#D9CBB0]">
      {m.kind === "unknown" && (
        <Stamp tone="stamp" className="stamp-mini absolute -top-2.5 right-2">
          Not on file
        </Stamp>
      )}
      {typed ? <TypedAnswer text={m.content} /> : <p className="text-[15px] leading-[22px] text-ink">{m.content}</p>}
      <p className="mt-1.5 text-[12px] leading-4 text-ink-subtle">{botLabel(m)}</p>
    </div>
  );
}

/* ---------- FAQ: the drawer ---------- */

function Faqs({ items, categories, lastAdded, onAdded }: { items: FaqItem[]; categories: string[]; lastAdded: string | null; onAdded: (question: string) => void }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [receipt, setReceipt] = useState<{ code: string; question: string; at: number } | null>(null);
  const [stampOn, setStampOn] = useState(false);

  useEffect(() => {
    if (!stampOn) return;
    const t = setTimeout(() => setStampOn(false), reduceMotion() ? 2000 : 1600);
    return () => clearTimeout(t);
  }, [stampOn]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/admin/faq", "POST", { question, answer, category });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Failed");
    const q = question;
    setReceipt({ code: cardNumber(q), question: q, at: Date.now() });
    setStampOn(true);
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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="mb-8 max-w-sm">
          <label htmlFor="faq-filter" className="block text-[14px] font-bold leading-[22px] text-ink">
            Find a card
          </label>
          <input id="faq-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} className="field mt-1 h-11" placeholder="Shipping, refund, seeds" />
        </div>

        {groups.length === 0 && <p className="text-[15px] leading-[22px] text-ink-muted">No cards match {quoted(filter.trim())}.</p>}

        <div className="space-y-9">
          {groups.map((g) => {
            const list = shown.filter((i) => i.category === g);
            return (
              <section key={g}>
                <h3 className="card-tab text-[13px]">
                  {g}
                  <span className="ml-2 text-ink-subtle">({list.length})</span>
                </h3>
                <ul className="divide-y divide-card-edge rounded-b-md rounded-tr-md border border-card-edge bg-card shadow-[0_1px_0_#D9CBB0,0_3px_0_-1px_#FFFDF6,0_4px_0_-1px_#D9CBB0]">
                  {list.map((f) => {
                    const isNew = newKey !== null && f.question.trim().toLowerCase() === newKey;
                    return (
                      <li key={f.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${isNew ? "is-new anim-filed-in" : ""}`}>
                        <div className="min-w-0">
                          <p className="font-card text-[12px] leading-4 text-ink-subtle">No. {cardNumber(f.question)}</p>
                          <p className="mt-0.5 font-display text-[16px] leading-[22px] text-ink">{f.question}</p>
                          <p className="mt-1 whitespace-pre-line font-card text-[14px] leading-5 text-ink-muted">{f.answer}</p>
                        </div>
                        <button type="button" onClick={() => remove(f.id)} className="inline-flex min-h-11 shrink-0 items-center px-1 text-[14px] text-error underline underline-offset-4">
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

      <form onSubmit={add} className="relative h-fit lg:sticky lg:top-6">
        <IndexCard tab="Blank card" title={<span role="heading" aria-level={3}>Write a new card</span>}>
          <div className="space-y-3">
            <Field id="nq" label="Question">
              <input id="nq" value={question} onChange={(e) => setQuestion(e.target.value)} className="field mt-1 h-11" />
            </Field>
            <Field id="na" label="Answer">
              <textarea id="na" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className="ruled-field mt-1" />
            </Field>
            <Field id="nc" label="Category">
              <input id="nc" list="faq-cats" value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1 h-11" />
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
            <button type="submit" disabled={busy || question.trim().length < 3 || answer.trim().length < 3} className="btn-primary w-full">
              {busy ? "Filing" : "File this card"}
            </button>
          </div>
        </IndexCard>
        {stampOn && (
          <Stamp tone="file" className="anim-stamp-now absolute right-3 top-[37px]">
            Filed
          </Stamp>
        )}
        <div role="status" aria-live="polite" className="mt-4">
          {receipt && (
            <p key={receipt.at} className="anim-receipt-in text-[14px] leading-5 text-ink-muted">
              Filed as card <span className="font-card text-ink">No. {receipt.code}</span>. The assistant answers {quoted(receipt.question)} from now on.
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
      <label htmlFor={id} className="block text-[14px] font-bold leading-[22px] text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
