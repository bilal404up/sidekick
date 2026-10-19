"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnswerText } from "@/components/AnswerText";
import { respond, type Reply } from "@/lib/engine/respond";
import { buildIndex, search, type Faq, type Index } from "@/lib/engine/retrieve";
import { aliasMap } from "@/lib/faqGroups";
import { citeLabel, citeMap, type Cite } from "@/lib/cite";

export interface UnansweredItem { id: string; question: string; created_at: string }
export interface ConversationItem { id: string; created_at: string; is_sample: boolean; messages: number; unanswered: number; first_question: string | null }
export interface FaqItem { id: string; category: string; question: string; answer: string }
interface Message { id: string; role: "user" | "bot"; content: string; kind: string | null; mode: string | null; created_at: string }

type Tab = "inbox" | "train" | "conversations" | "faq";
type Logged = { key: string; text: string; how: "Answered" | "Taught" | "Added" };
type Draft = { answer: string; category: string };

const REVIEWED_KEY = "sidekick.train.reviewed";
const SEEN_KEY = "sidekick.train.seen";
const TRANSCRIPTS = 20;

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const quoted = (s: string) => `“${s}”`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const narrow = () => window.matchMedia("(max-width: 1023px)").matches;
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

/** Everything derived from the FAQ list: the same search index the assistant uses, main entries, taught wordings and citation numbers. */
interface Library {
  index: Index;
  byId: Map<string, FaqItem>;
  mainOf: (id: string) => string;
  mains: FaqItem[];
  wordings: Map<string, FaqItem[]>;
  categories: string[];
  cites: Record<string, Cite>;
}

function useLibrary(faqs: FaqItem[]): Library {
  return useMemo(() => {
    const aliases = aliasMap(faqs);
    const byId = new Map(faqs.map((f) => [f.id, f] as const));
    const wordings = new Map<string, FaqItem[]>();
    aliases.forEach((main, id) => {
      const f = byId.get(id);
      if (f) wordings.set(main, [...(wordings.get(main) ?? []), f]);
    });
    return {
      index: buildIndex(faqs as Faq[]),
      byId,
      mainOf: (id: string) => aliases.get(id) ?? id,
      mains: faqs.filter((f) => !aliases.has(f.id)),
      wordings,
      categories: Array.from(new Set(faqs.map((f) => f.category))).sort(),
      cites: citeMap(faqs, aliases),
    };
  }, [faqs]);
}

const num = (lib: Library, id: string) => (lib.cites[id] ? citeLabel(lib.cites[id].n) : "§");

/** The closest main entries for a question, best first, even below the answering cutoff. */
function closest(lib: Library, text: string, exclude?: string): FaqItem[] {
  const out: FaqItem[] = [];
  for (const m of search(lib.index, text, 8)) {
    const main = lib.byId.get(lib.mainOf(m.faq.id));
    if (main && main.id !== exclude && !out.some((o) => o.id === main.id)) out.push(main);
    if (out.length === 3) break;
  }
  return out;
}

export function AdminConsole({ unanswered, conversations, faqs }: { unanswered: UnansweredItem[]; conversations: ConversationItem[]; faqs: FaqItem[] }) {
  const router = useRouter();
  const lib = useLibrary(faqs);
  const [tab, setTab] = useState<Tab>("inbox");
  const [trainOpened, setTrainOpened] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ text: string; at: number } | null>(null);
  const [session, setSession] = useState<Logged[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [toReview, setToReview] = useState<number | null>(null);
  const [toast, setToast] = useState<number | null>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const ready = useRef(false);
  useEffect(() => {
    ready.current = true;
  }, []);
  useEffect(() => {
    if (toast === null) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const inbox = unanswered.filter((u) => !hidden.has(u.id));

  function log(text: string, how: Logged["how"]) {
    setSession((s) => [{ key: `${Date.now()}-${s.length}`, text, how }, ...s].slice(0, 8));
    setLastAdded(text);
  }
  function hide(id: string) {
    setHidden((s) => new Set(s).add(id));
  }
  function onInboxDone(u: UnansweredItem, action: "add" | "dismiss") {
    hide(u.id);
    if (action === "add") {
      log(u.question, "Answered");
      setToast(Date.now());
      setNotice({ text: `Added ${quoted(u.question)} to the FAQ. Customers get this answer from now on.`, at: Date.now() });
    } else {
      setNotice({ text: `Dismissed ${quoted(u.question)}. It won't be added to the FAQ.`, at: Date.now() });
    }
    router.refresh();
  }
  function onTaught(text: string, inboxId?: string) {
    if (inboxId) hide(inboxId);
    log(text, "Taught");
    router.refresh();
  }
  function onFaqAdded(question: string) {
    log(question, "Added");
    router.refresh();
  }
  function select(t: Tab) {
    setTab(t);
    if (t === "train") setTrainOpened(true);
  }

  const tabs: Array<{ key: Tab; label: string; short?: string; count: number | null; tone: string }> = [
    { key: "inbox", label: "Inbox", count: inbox.length, tone: inbox.length ? "bg-ember text-white" : "bg-[#E6E2D7] text-ink-2" },
    { key: "train", label: "Train", count: toReview, tone: toReview ? "bg-ink text-paper" : "bg-[#E6E2D7] text-ink-2" },
    { key: "conversations", label: "Conversations", short: "Chats", count: conversations.length, tone: "bg-[#E6E2D7] text-ink-2" },
    { key: "faq", label: "FAQ", count: lib.mains.length, tone: "bg-moss-tint text-moss" },
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
    select(order[n]);
    tabRefs.current[order[n]]?.focus();
  }

  return (
    <div>
      <div className="max-w-full overflow-x-auto">
        <div role="tablist" aria-label="Owner sections" onKeyDown={onTabKey} className="flex gap-5 border-b border-rule sm:gap-7">
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
                onClick={() => select(t.key)}
                className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-0.5 font-mono text-[12px] font-medium uppercase tracking-[0.06em] transition-colors duration-150 sm:gap-2.5 ${
                  on ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {t.short ? (
                  <>
                    <span className="sm:hidden">{t.short}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                  </>
                ) : (
                  t.label
                )}
                {t.count !== null && (
                  <span key={`${t.key}-${t.count}`} className={`count ${t.tone} ${ready.current ? "anim-bump" : ""}`}>
                    {t.count}
                  </span>
                )}
                <span aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-0.5 transition-colors duration-150 ${on ? "bg-ink" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="pt-8">
        {tab === "inbox" && (
          <div role="tabpanel" id="panel-inbox" aria-labelledby="tab-inbox">
            <Inbox items={inbox} lib={lib} notice={notice} wordingCount={faqs.length - lib.mains.length} session={session} animate={ready.current} onDone={onInboxDone} />
          </div>
        )}
        {trainOpened && (
          <div role="tabpanel" id="panel-train" aria-labelledby="tab-train" hidden={tab !== "train"}>
            <Train conversations={conversations} faqs={faqs} lib={lib} inbox={inbox} onTaught={onTaught} onCount={setToReview} />
          </div>
        )}
        {tab === "conversations" && (
          <div role="tabpanel" id="panel-conversations" aria-labelledby="tab-conversations">
            <Conversations items={conversations} />
          </div>
        )}
        {tab === "faq" && (
          <div role="tabpanel" id="panel-faq" aria-labelledby="tab-faq">
            <Faqs lib={lib} lastAdded={lastAdded} onAdded={onFaqAdded} />
          </div>
        )}
      </div>
      {toast !== null && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <p key={toast} role="status" className="anim-rise rounded-sm bg-ink px-4 py-2.5 text-[14px] font-medium leading-5 text-paper shadow-lift">
            Added to the FAQ
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Inbox: list of open questions, one composer for the selected one ---------- */

function Inbox({
  items,
  lib,
  notice,
  wordingCount,
  session,
  animate,
  onDone,
}: {
  items: UnansweredItem[];
  lib: Library;
  notice: { text: string; at: number } | null;
  wordingCount: number;
  session: Logged[];
  animate: boolean;
  onDone: (u: UnansweredItem, action: "add" | "dismiss") => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const composerRef = useRef<HTMLDivElement>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);
  const acted = useRef(false);
  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  const near = useMemo(() => new Map(items.map((u) => [u.id, closest(lib, u.question)[0]] as const)), [items, lib]);

  // After an item leaves, focus the next answer field so the owner can keep going.
  useEffect(() => {
    if (!acted.current) return;
    acted.current = false;
    const next = composerRef.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (next) next.focus();
    else emptyRef.current?.focus();
  }, [items.length]);

  function pick(id: string, focusRow = false) {
    setSelectedId(id);
    if (focusRow) rowRefs.current.get(id)?.focus();
    else if (narrow()) composerRef.current?.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
  }

  function finish(u: UnansweredItem, action: "add" | "dismiss") {
    const i = items.findIndex((x) => x.id === u.id);
    const next = items[i + 1] ?? items[i - 1];
    setSelectedId(next?.id ?? null);
    acted.current = true;
    onDone(u, action);
  }

  async function quickDismiss(u: UnansweredItem) {
    setDismissing(u.id);
    setListError(null);
    const r = await api("/api/admin/unanswered", "POST", { id: u.id, action: "dismiss", answer: "", category: "General" });
    setDismissing(null);
    if (!r.ok) return setListError(r.error ?? "Failed");
    finish(u, "dismiss");
  }

  function onListKey(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = items.findIndex((x) => x.id === selected?.id);
    const n = e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
    if (items[n]) {
      e.preventDefault();
      pick(items[n].id, true);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-rule py-3 text-[13px] leading-5 text-ink-2">
        <p>
          <span key={lib.mains.length} className={`cite inline-block text-[15px] text-ink ${animate ? "anim-bump" : ""}`}>
            {lib.mains.length}
          </span>{" "}
          answers in the FAQ
          {wordingCount > 0 && (
            <>
              , plus <span className="cite text-ink">{wordingCount}</span> taught {wordingCount === 1 ? "wording" : "wordings"}
            </>
          )}
        </p>
        <p>Answers go live on the next question. No publish step.</p>
      </div>

      <div role="status" aria-live="polite">
        {notice && (
          <p key={notice.at} className="anim-rise mb-6 border-l-2 border-moss bg-moss-tint px-4 py-3 text-[14px] leading-5 text-ink">
            {notice.text}
          </p>
        )}
      </div>

      {items.length === 0 || !selected ? (
        <div className="max-w-[640px] border-t border-ink pt-6">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" focusable="false" className="mb-5 text-moss">
            <path d="M8 34h10l3 5h14l3-5h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M10 34 16 12h24l6 22v8H10Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path
              className="empty-tick"
              d="M22 26l4 4 8-9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={20}
              strokeDasharray="20"
            />
          </svg>
          <h2 ref={emptyRef} tabIndex={-1} className="display text-[32px] leading-[36px]">
            Nothing waiting.
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-ink-2">When the assistant can&apos;t find an answer, the question shows up here so you can add it.</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10">
          <div className="min-w-0">
            <p className="flex items-baseline justify-between border-b border-ink pb-2.5">
              <span className="label text-ink">Open questions</span>
              <span className="font-mono text-[12px] text-ink-2">{items.length}</span>
            </p>
            <ul aria-label="Open questions" onKeyDown={onListKey} className="divide-y divide-rule lg:max-h-[640px] lg:overflow-y-auto">
              {items.map((u, idx) => {
                const on = u.id === selected.id;
                const hint = near.get(u.id);
                return (
                  <li
                    key={u.id}
                    style={{ ["--i" as string]: Math.min(idx, 6) }}
                    className={`inbox-item flex items-stretch transition-colors duration-150 ${on ? "bg-sheet shadow-[inset_2px_0_0_#B3501A]" : "hover:bg-sheet"} ${animate ? "" : "anim-rise"}`}
                  >
                    <button
                      ref={(el) => {
                        if (el) rowRefs.current.set(u.id, el);
                        else rowRefs.current.delete(u.id);
                      }}
                      type="button"
                      aria-current={on ? "true" : undefined}
                      onClick={() => pick(u.id)}
                      className="min-h-11 min-w-0 flex-1 py-3.5 pl-4 pr-2 text-left"
                    >
                      <span className="block font-mono text-[12px] leading-4 text-ink-2">{when(u.created_at)}</span>
                      <span className={`mt-1 line-clamp-2 block text-[15px] leading-[22px] ${on ? "font-semibold" : "font-medium"}`}>{u.question}</span>
                      {hint && (
                        <span className="mt-1 block truncate text-[13px] leading-[18px] text-ink-3">
                          Near <span className="cite">{num(lib, hint.id)}</span> {hint.question}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => quickDismiss(u)}
                      disabled={dismissing !== null}
                      aria-label={`Dismiss ${quoted(u.question)}`}
                      className="btn-quiet mr-1 self-center px-2.5 text-[13px] text-ink-3"
                    >
                      {dismissing === u.id ? "Dismissing" : "Dismiss"}
                    </button>
                  </li>
                );
              })}
            </ul>
            {listError && (
              <p role="alert" className="mt-2 text-[13px] leading-[18px] text-error">
                {listError}
              </p>
            )}
          </div>

          <div ref={composerRef} className="order-first min-w-0 scroll-mt-4 lg:order-none">
            <Composer
              key={selected.id}
              u={selected}
              lib={lib}
              draft={drafts[selected.id] ?? { answer: "", category: "General" }}
              onDraft={(d) => setDrafts((all) => ({ ...all, [selected.id]: d }))}
              onDone={(action) => finish(selected, action)}
            />
            {session.length > 0 && (
              <div className="mt-8">
                <p className="label border-b border-rule pb-2 text-ink-2">This session</p>
                <ul className="mt-3 space-y-2">
                  {session.map((s) => (
                    <li key={s.key} className="anim-rise flex gap-3 text-[14px] leading-5">
                      <span className="label w-[76px] shrink-0 pt-0.5 text-moss">{s.how}</span>
                      <span className="min-w-0">{s.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Composer({ u, lib, draft, onDraft, onDone }: { u: UnansweredItem; lib: Library; draft: Draft; onDraft: (d: Draft) => void; onDone: (action: "add" | "dismiss") => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"add" | "dismiss" | null>(null);
  const [phase, setPhase] = useState<"idle" | "added" | "leaving">("idle");
  const suggestions = useMemo(() => closest(lib, u.question).slice(0, 2), [lib, u.question]);
  const busy = pending !== null;
  const { answer, category } = draft;
  const canAdd = !busy && answer.trim().length >= 3;

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
    <div className={`card p-5 transition-colors duration-150 sm:p-8 ${phase === "leaving" ? "anim-slide-out" : ""} ${success ? "border-moss" : ""}`}>
      <p className="label text-ember-dark">Asked {when(u.created_at)}</p>
      <h2 className="display mt-3 break-words text-[30px] leading-[36px] sm:text-[38px] sm:leading-[44px]">{quoted(u.question)}</h2>
      {success ? (
        <p role="status" className="anim-fade mt-6 flex items-center gap-2.5 text-[15px] font-medium leading-[22px] text-moss">
          <span aria-hidden="true" className="anim-pop grid h-6 w-6 shrink-0 place-items-center rounded-full bg-moss text-white">
            <Check />
          </span>
          Added to the FAQ. Customers get this answer from now on.
        </p>
      ) : (
        <div className="mt-6">
          {suggestions.length > 0 && (
            <div className="mb-5">
              <p className="label text-ink-2">Similar entries already in the FAQ</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s.id} type="button" disabled={busy} onClick={() => onDraft({ answer: s.answer, category: s.category })} className="chip whitespace-normal py-2">
                    <span className="cite text-[12px] text-moss">{num(lib, s.id)}</span>
                    <span>Use the answer from {quoted(s.question)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <label htmlFor={`a-${u.id}`} className="block text-[14px] font-medium leading-5">
            Answer to add to the FAQ
          </label>
          <textarea
            id={`a-${u.id}`}
            value={answer}
            onChange={(e) => onDraft({ answer: e.target.value, category })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canAdd) {
                e.preventDefault();
                act("add");
              }
            }}
            rows={4}
            disabled={busy}
            aria-describedby={`k-${u.id}`}
            className="field mt-1.5 py-2.5 leading-[23px]"
            placeholder="Write the answer customers should get"
          />
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={`c-${u.id}`} className="block text-[14px] font-medium leading-5">
                Category
              </label>
              <input id={`c-${u.id}`} list={`cats-${u.id}`} value={category} onChange={(e) => onDraft({ answer, category: e.target.value })} disabled={busy} className="field mt-1.5 h-11 w-52" />
              <datalist id={`cats-${u.id}`}>
                {lib.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" disabled={busy} onClick={() => act("dismiss")} className="btn-quiet">
                {pending === "dismiss" ? "Dismissing" : "Dismiss"}
              </button>
              <button type="button" disabled={!canAdd} onClick={() => act("add")} className="btn-moss">
                {pending === "add" ? "Adding" : "Add to FAQ"}
              </button>
            </div>
          </div>
          <p id={`k-${u.id}`} className="mt-4 font-mono text-[12px] leading-[18px] text-ink-2">
            Ctrl or Cmd + Enter adds the answer. Up and down arrows move through the list.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[13px] leading-[18px] text-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Train ---------- */

interface Asked {
  key: string;
  text: string;
  at: string;
  times: number;
}

function Train({
  conversations,
  faqs,
  lib,
  inbox,
  onTaught,
  onCount,
}: {
  conversations: ConversationItem[];
  faqs: FaqItem[];
  lib: Library;
  inbox: UnansweredItem[];
  onTaught: (text: string, inboxId?: string) => void;
  onCount: (n: number | null) => void;
}) {
  const [items, setItems] = useState<Asked[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [limited, setLimited] = useState(false);
  const [previews, setPreviews] = useState<Record<string, Reply>>({});
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const [seen, setSeen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todo" | "all">("todo");
  const ids = conversations
    .slice(0, TRANSCRIPTS)
    .map((c) => c.id)
    .join(",");
  const total = ids ? ids.split(",").length : 0;

  // Reviewed questions and the last visit are remembered in this browser only.
  useEffect(() => {
    try {
      setReviewed(new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY) ?? "[]") as string[]));
      setSeen(localStorage.getItem(SEEN_KEY));
      localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      // Storage can be unavailable in private windows. Training still works; it just won't remember.
    }
  }, []);

  // Read recent transcripts four at a time and collect every question customers typed.
  useEffect(() => {
    let cancelled = false;
    const list = ids ? ids.split(",") : [];
    (async () => {
      const found = new Map<string, Asked>();
      let done = 0;
      let stop = false;
      for (let i = 0; i < list.length && !stop && !cancelled; i += 4) {
        const batch = await Promise.all(
          list.slice(i, i + 4).map(async (id) => {
            try {
              const res = await fetch(`/api/admin/conversation?id=${id}`);
              if (res.status === 429) return "limit" as const;
              const data = await res.json();
              return res.ok ? (data.messages as Message[]) : null;
            } catch {
              return null;
            }
          })
        );
        for (const msgs of batch) {
          if (msgs === "limit") {
            stop = true;
            continue;
          }
          done += 1;
          if (!msgs) continue;
          msgs.forEach((m, j) => {
            if (m.role !== "user" || msgs[j + 1]?.kind === "smalltalk") return;
            const key = norm(m.content);
            if (!key) return;
            const prev = found.get(key);
            if (prev) {
              prev.times += 1;
              if (m.created_at > prev.at) prev.at = m.created_at;
            } else {
              found.set(key, { key, text: m.content.trim(), at: m.created_at, times: 1 });
            }
          });
        }
        if (!cancelled) setProgress(done);
      }
      if (cancelled) return;
      setLimited(stop);
      setItems(Array.from(found.values()).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)));
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  // What the assistant would answer today, using the same engine and the current FAQ.
  useEffect(() => {
    if (!items) return;
    let off = false;
    (async () => {
      const out: Record<string, Reply> = {};
      for (const it of items) out[it.key] = await respond(it.text, faqs as Faq[], { index: lib.index });
      if (!off) setPreviews(out);
    })();
    return () => {
      off = true;
    };
  }, [items, faqs, lib.index]);

  const rows = (items ?? []).filter((i) => previews[i.key]?.kind !== "smalltalk");
  const todo = rows.filter((i) => !reviewed.has(i.key));
  const shown = filter === "todo" ? todo : rows;
  const inboxByKey = useMemo(() => new Map(inbox.map((u) => [norm(u.question), u] as const)), [inbox]);

  useEffect(() => {
    onCount(items ? todo.length : null);
  }, [items, todo.length, onCount]);

  function markReviewed(key: string) {
    setReviewed((s) => {
      const next = new Set(s).add(key);
      try {
        localStorage.setItem(REVIEWED_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Not remembered, but still marked for this visit.
      }
      return next;
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-3">
          <p className="max-w-[60ch] text-[14px] leading-[21px] text-ink-2">
            Every question customers asked, newest first, with what the assistant answers today. When it&apos;s wrong, teach it.
          </p>
          <div role="group" aria-label="Show" className="inline-flex rounded-sm border border-rule-strong bg-sheet p-0.5">
            <Seg on={filter === "todo"} onClick={() => setFilter("todo")}>
              To review{items ? ` (${todo.length})` : ""}
            </Seg>
            <Seg on={filter === "all"} onClick={() => setFilter("all")}>
              All
            </Seg>
          </div>
        </div>
        {items === null ? (
          <div>
            <p role="status" className="py-3 font-mono text-[12px] leading-4 text-ink-2">
              Reading recent conversations ({progress} of {total})
            </p>
            <ul aria-hidden="true" className="divide-y divide-rule border-t border-rule">
              {[72, 56, 64, 48].map((w, i) => (
                <li key={i} className="py-5">
                  <span className="skeleton block h-3 w-28" />
                  <span className="skeleton mt-3 block h-4" style={{ width: `${w}%` }} />
                  <span className="skeleton mt-3 block h-3 w-1/3" />
                </li>
              ))}
            </ul>
          </div>
        ) : shown.length === 0 ? (
          <div className="pt-6">
            <h2 className="display text-[32px] leading-[36px]">{rows.length ? "All reviewed." : "No questions yet."}</h2>
            <p className="mt-2 text-[15px] leading-6 text-ink-2">New questions show up here as customers ask them.</p>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {shown.map((it) => (
              <TrainRow
                key={it.key}
                item={it}
                reply={previews[it.key]}
                isNew={seen !== null && it.at > seen}
                reviewed={reviewed.has(it.key)}
                lib={lib}
                inboxItem={inboxByKey.get(it.key)}
                onReviewed={markReviewed}
                onTaught={onTaught}
              />
            ))}
          </ul>
        )}
        {limited && <p className="mt-4 text-[13px] leading-[18px] text-ink-2">Some conversations weren&apos;t read because of the rate limit. Reload in a minute to see more.</p>}
      </div>
      <aside aria-label="How training works" className="h-fit space-y-3 border-t border-ink pt-3 text-[14px] leading-[22px] text-ink-2 lg:sticky lg:top-6">
        <h2 className="label text-ink">How training works</h2>
        <p>Teaching adds the customer&apos;s wording to the FAQ with the answer you choose, so the next person who asks it that way gets that answer.</p>
        <p>The assistant still answers only from the FAQ. Training never lets it say anything new.</p>
        <p>Taught wordings appear under their main entry in the FAQ tab, where you can remove them.</p>
      </aside>
    </div>
  );
}

function TrainRow({
  item,
  reply,
  isNew,
  reviewed,
  lib,
  inboxItem,
  onReviewed,
  onTaught,
}: {
  item: Asked;
  reply?: Reply;
  isNew: boolean;
  reviewed: boolean;
  lib: Library;
  inboxItem?: UnansweredItem;
  onReviewed: (key: string) => void;
  onTaught: (text: string, inboxId?: string) => void;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [chosenId, setChosenId] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("General");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const currentId = reply?.kind === "answer" ? reply.sources[0]?.id : undefined;
  const current = currentId ? lib.byId.get(lib.mainOf(currentId)) : undefined;
  const suggestions = useMemo(() => closest(lib, item.text, current?.id), [lib, item.text, current?.id]);
  const exists = useMemo(() => Array.from(lib.byId.values()).some((f) => norm(f.question) === item.key), [lib, item.key]);
  const chosen = chosenId ? lib.byId.get(chosenId) : undefined;
  const answer = mode === "existing" ? chosen?.answer ?? "" : draft.trim();
  const cat = mode === "existing" ? chosen?.category ?? "General" : category.trim() || "General";

  function start() {
    setOpen(true);
    if (!chosenId && suggestions[0]) setChosenId(suggestions[0].id);
  }

  async function save() {
    if (answer.length < 3 || exists) return;
    setPending(true);
    setError(null);
    const r = inboxItem
      ? await api("/api/admin/unanswered", "POST", { id: inboxItem.id, action: "add", answer, category: cat })
      : await api("/api/admin/faq", "POST", { question: item.text, answer, category: cat });
    setPending(false);
    if (!r.ok) {
      setError(r.error ?? "Failed");
      return;
    }
    setDone(true);
    await wait(1100);
    setOpen(false);
    setDone(false);
    onReviewed(item.key);
    onTaught(item.text, inboxItem?.id);
  }

  return (
    <li className="py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] leading-4 text-ink-2">
        {isNew && <span className="rounded-xs bg-ink px-1.5 py-0.5 uppercase tracking-[0.06em] text-paper">New</span>}
        <span>Asked {when(item.at)}</span>
        {item.times > 1 && <span>{item.times} times</span>}
        {reviewed && <span className="rounded-xs border border-rule px-1.5 py-0.5 uppercase tracking-[0.06em]">Reviewed</span>}
      </div>
      <p className="mt-2 text-[17px] font-semibold leading-6">{quoted(item.text)}</p>
      <p className="mt-2 flex items-start gap-2 text-[14px] leading-5">
        {reply === undefined ? (
          <span className="text-ink-2">Checking what it answers</span>
        ) : current ? (
          <>
            <span className="cite shrink-0 rounded-xs bg-moss px-1.5 py-0.5 text-[12px] leading-4 text-white">{num(lib, current.id)}</span>
            <span>
              <span className="text-ink-2">Answers with </span>
              <span className="font-medium">{current.question}</span>
            </span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-ember" />
            <span className="text-ember-dark">Not in the FAQ{inboxItem ? ", waiting in the inbox" : ""}</span>
          </>
        )}
      </p>

      {done ? (
        <p role="status" className="anim-fade mt-4 flex items-center gap-2.5 text-[15px] font-medium leading-[22px] text-moss">
          <span aria-hidden="true" className="anim-pop grid h-6 w-6 shrink-0 place-items-center rounded-full bg-moss text-white">
            <Check />
          </span>
          Taught. Customers who ask it this way now get this answer.
        </p>
      ) : !open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {current && !reviewed && (
            <button type="button" onClick={() => onReviewed(item.key)} className="btn-secondary">
              Looks right
            </button>
          )}
          <button type="button" onClick={start} className={current ? "btn-quiet" : "btn-moss"}>
            {current ? "Teach a better answer" : "Teach it"}
          </button>
          {!current && !reviewed && (
            <button type="button" onClick={() => onReviewed(item.key)} className="btn-quiet">
              Skip
            </button>
          )}
        </div>
      ) : (
        <div className="anim-fade card mt-4 p-4 sm:p-5">
          <div role="group" aria-label="How to teach it" className="inline-flex flex-wrap rounded-sm border border-rule-strong bg-sheet p-0.5">
            <Seg on={mode === "existing"} onClick={() => setMode("existing")}>
              Use an existing answer
            </Seg>
            <Seg on={mode === "new"} onClick={() => setMode("new")}>
              Write a new answer
            </Seg>
          </div>

          {mode === "existing" ? (
            <div className="mt-4 space-y-3">
              {suggestions.length > 0 && (
                <fieldset>
                  <legend className="label text-ink-2">Closest entries</legend>
                  <div className="mt-2 space-y-2">
                    {suggestions.map((s) => (
                      <label
                        key={s.id}
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-sm border p-3 text-[14px] leading-5 transition-colors duration-150 ${
                          chosenId === s.id ? "border-moss bg-moss-tint" : "border-rule bg-sheet hover:border-rule-strong"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-pick`}
                          value={s.id}
                          checked={chosenId === s.id}
                          onChange={() => setChosenId(s.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1D5A3C]"
                        />
                        <span className="cite shrink-0 text-[12px] leading-5 text-moss">{num(lib, s.id)}</span>
                        <span className="font-medium">{s.question}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div>
                <label htmlFor={`${uid}-any`} className="block text-[13px] font-medium leading-[18px]">
                  Or pick any entry
                </label>
                <select id={`${uid}-any`} value={chosenId} onChange={(e) => setChosenId(e.target.value)} className="field mt-1.5 h-11">
                  <option value="" disabled>
                    Choose an entry
                  </option>
                  {lib.categories.map((c) => (
                    <optgroup key={c} label={c}>
                      {lib.mains
                        .filter((f) => f.category === c)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {num(lib, f.id)} {f.question}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {chosen && (
                <div className="rounded-sm border-l-2 border-moss bg-paper p-3">
                  <p className="label text-ink-2">Customers who ask this will get</p>
                  <AnswerText text={chosen.answer} className="mt-1.5 text-[14px] leading-[21px]" />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor={`${uid}-new`} className="block text-[13px] font-medium leading-[18px]">
                  Answer customers should get
                </label>
                <textarea id={`${uid}-new`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="field mt-1.5 py-2.5 leading-[22px]" />
              </div>
              <div>
                <label htmlFor={`${uid}-cat`} className="block text-[13px] font-medium leading-[18px]">
                  Category
                </label>
                <input id={`${uid}-cat`} list={`${uid}-cats`} value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1.5 h-11 w-56 max-w-full" />
                <datalist id={`${uid}-cats`}>
                  {lib.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {exists && (
            <p className="mt-3 text-[13px] leading-[18px] text-ember-dark">
              This exact wording is already an FAQ entry, so there&apos;s nothing to teach. Change or delete that entry in the FAQ tab instead.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[13px] leading-[18px] text-error">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={pending || exists || answer.length < 3} className="btn-moss">
              {pending ? "Teaching" : "Teach this wording"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-quiet">
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-xs px-3 text-[13px] font-medium transition-colors duration-150 ${on ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/* ---------- Conversations ---------- */

const MODE_LABEL: Record<string, string> = {
  faq: "Quoted from the FAQ",
  model: "Reworded by the language model from one entry",
  "model-fallback": "Quoted from the FAQ (model unavailable)",
};

function Conversations({ items }: { items: ConversationItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const current = items.find((c) => c.id === selected);

  async function open(id: string, scroll = true) {
    setSelected(id);
    setMessages(null);
    setError(null);
    if (scroll && narrow()) {
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

  // Open the newest conversation, so the right side is never an empty pane.
  useEffect(() => {
    if (items[0]) open(items[0].id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) {
    return <p className="text-[15px] leading-[22px] text-ink-2">No conversations yet. Ask the assistant something on the home page and it will appear here.</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-10">
      <div className="min-w-0">
        <p className="flex items-baseline justify-between border-b border-ink pb-2.5">
          <span className="label text-ink">Recent conversations</span>
          <span className="font-mono text-[12px] text-ink-2">{items.length}</span>
        </p>
        <ul className="max-h-[420px] divide-y divide-rule overflow-y-auto lg:max-h-[640px]">
          {items.map((c) => {
            const on = selected === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => open(c.id)}
                  aria-pressed={on}
                  className={`block w-full px-4 py-3.5 text-left transition-colors duration-150 ${on ? "bg-sheet shadow-[inset_2px_0_0_#16181B]" : "hover:bg-sheet/60"}`}
                >
                  <span className="block font-mono text-[12px] leading-4 text-ink-2">{when(c.created_at)}</span>
                  <span className={`mt-1 block truncate text-[15px] leading-[22px] ${on ? "font-semibold" : "font-medium"}`}>{c.first_question ?? "(no questions)"}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] leading-4 text-ink-2">
                    <span>{c.messages} messages</span>
                    {c.unanswered > 0 && <span className="rounded-xs bg-ember-tint px-1.5 py-0.5 text-ember-dark">{c.unanswered} not in FAQ</span>}
                    {c.is_sample && <span className="rounded-xs border border-rule px-1.5 py-0.5">sample</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div ref={paneRef} className="card min-h-[320px] min-w-0 scroll-mt-4">
        <div className="flex items-baseline justify-between gap-3 border-b border-rule px-5 py-3">
          <span className="label text-ink-2">Transcript</span>
          {current && <span className="font-mono text-[12px] text-ink-2">{when(current.created_at)}</span>}
        </div>
        <div className="p-5 sm:p-6">
          {!selected && <p className="text-[15px] leading-[22px] text-ink-2">Select a conversation on the left.</p>}
          {selected && !messages && !error && (
            <div role="status" aria-label="Loading the conversation" className="space-y-4">
              <span className="skeleton ml-auto block h-9 w-1/2" />
              <span className="skeleton block h-16 w-3/4" />
              <span className="skeleton ml-auto block h-9 w-2/5" />
            </div>
          )}
          {error && (
            <p role="alert" className="text-[14px] leading-5 text-error">
              {error}
            </p>
          )}
          {messages && (
            <ol className="space-y-5">
              {messages.map((m) => (
                <li key={m.id}>
                  <Bubble m={m} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg rounded-br-xs bg-ink px-4 py-2.5 text-[15px] leading-[22px] text-paper">{m.content}</p>
      </div>
    );
  }
  const unknown = m.kind === "unknown";
  const label = unknown ? "Not in the FAQ, sent to the inbox" : (m.mode && MODE_LABEL[m.mode]) || "Small talk";
  return (
    <div className="max-w-[92%]">
      <div className={`text-[15px] leading-[23px] ${unknown ? "border-l-2 border-ember py-0.5 pl-4" : "rounded-lg rounded-bl-xs bg-paper px-4 py-3"}`}>
        {m.mode === "faq" || m.mode === "model-fallback" ? <AnswerText text={m.content} /> : <p className="whitespace-pre-line">{m.content}</p>}
      </div>
      <p className={`mt-1.5 flex items-center gap-2 font-mono text-[12px] leading-4 ${unknown ? "text-ember-dark" : "text-ink-2"}`}>
        <span aria-hidden="true" className={`h-px w-3 ${unknown ? "bg-ember" : m.mode && MODE_LABEL[m.mode] ? "bg-moss" : "bg-rule-strong"}`} />
        {label}
      </p>
    </div>
  );
}

/* ---------- FAQ ---------- */

function Faqs({ lib, lastAdded, onAdded }: { lib: Library; lastAdded: string | null; onAdded: (question: string) => void }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  // The row menu closes on Escape (focus returns to its button) or a click anywhere else.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-menu="${menu}"]`)) setMenu(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        triggers.current.get(menu)?.focus();
        setMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

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

  async function remove(id: string, wording: boolean) {
    setMenu(null);
    const message = wording ? "Remove this wording? The answer stays in the FAQ; only this way of asking is removed." : "Delete this FAQ entry? The assistant will stop answering it.";
    if (!window.confirm(message)) return;
    const r = await api(`/api/admin/faq?id=${id}`, "DELETE");
    if (!r.ok) return setError(r.error ?? "Failed");
    router.refresh();
  }

  const needle = filter.trim().toLowerCase();
  const matches = (f: FaqItem) => `${f.question} ${f.answer} ${f.category}`.toLowerCase().includes(needle);
  const shown = needle ? lib.mains.filter((f) => matches(f) || (lib.wordings.get(f.id) ?? []).some(matches)) : lib.mains;
  const groups = Array.from(new Set(shown.map((i) => i.category)));
  const newKey = lastAdded ? norm(lastAdded) : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="mb-8 max-w-sm">
          <label htmlFor="faq-filter" className="block text-[14px] font-medium leading-5">
            Find an entry
          </label>
          <input id="faq-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} className="field mt-1.5 h-11" placeholder="Shipping, refund, seeds" />
        </div>
        {groups.length === 0 && <p className="text-[15px] leading-[22px] text-ink-2">No entries match {quoted(filter.trim())}.</p>}
        <div className="space-y-10">
          {groups.map((g) => {
            const list = shown.filter((i) => i.category === g);
            return (
              <section key={g}>
                <h3 className="flex items-baseline justify-between border-b border-ink pb-2.5">
                  <span className="label text-ink">{g}</span>
                  <span className="font-mono text-[12px] font-normal text-ink-2">{list.length}</span>
                </h3>
                <ul className="divide-y divide-rule">
                  {list.map((f) => {
                    const extra = lib.wordings.get(f.id) ?? [];
                    const isNew = newKey !== null && [f, ...extra].some((x) => norm(x.question) === newKey);
                    const label = num(lib, f.id);
                    return (
                      <li key={f.id} className={`grid grid-cols-[44px_minmax(0,1fr)_auto] gap-x-2 py-4 pr-1 ${isNew ? "is-new anim-rise" : ""}`}>
                        <span className="cite pl-1 pt-0.5 text-[12px] leading-5 text-ink-3">{label}</span>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold leading-[22px]">{f.question}</p>
                          <AnswerText text={f.answer} className="mt-1 text-[14px] leading-[22px] text-ink-2" />
                          {extra.length > 0 && (
                            <div className="mt-3">
                              <p className="label text-ink-2">Also asked as</p>
                              <ul className="mt-1">
                                {extra.map((w) => (
                                  <li key={w.id} className="flex items-center justify-between gap-3 text-[14px] leading-5">
                                    <span className="min-w-0">{quoted(w.question)}</span>
                                    <button type="button" onClick={() => remove(w.id, true)} className="btn-quiet shrink-0" aria-label={`Remove the wording ${quoted(w.question)}`}>
                                      Remove
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div data-menu={f.id} className="relative -mt-2.5">
                          <button
                            ref={(el) => {
                              if (el) triggers.current.set(f.id, el);
                              else triggers.current.delete(f.id);
                            }}
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={menu === f.id}
                            aria-label={`Actions for ${label} ${f.question}`}
                            onClick={() => setMenu((m) => (m === f.id ? null : f.id))}
                            className="grid h-11 w-11 place-items-center rounded-sm text-ink-2 transition-colors duration-150 hover:bg-sheet hover:text-ink"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                              <circle cx="3" cy="8" r="1.4" fill="currentColor" />
                              <circle cx="8" cy="8" r="1.4" fill="currentColor" />
                              <circle cx="13" cy="8" r="1.4" fill="currentColor" />
                            </svg>
                          </button>
                          {menu === f.id && (
                            <div role="menu" aria-label={`Actions for ${label}`} className="anim-fade absolute right-0 top-11 z-20 w-52 rounded-sm border border-rule bg-sheet p-1 shadow-lift">
                              <button
                                ref={(el) => el?.focus()}
                                role="menuitem"
                                type="button"
                                onClick={() => remove(f.id, false)}
                                className="flex min-h-11 w-full items-center rounded-xs px-3 text-left text-[14px] font-medium text-error hover:bg-paper"
                              >
                                Delete entry
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <form onSubmit={add} className="card h-fit space-y-4 p-5 sm:p-7 lg:sticky lg:top-6">
        <div>
          <p className="label text-ink-2">New entry</p>
          <h3 className="display mt-2 text-[30px] font-normal leading-[34px]">Add an entry</h3>
        </div>
        <Field id="nq" label="Question">
          <input id="nq" value={question} onChange={(e) => setQuestion(e.target.value)} className="field mt-1.5 h-11" />
        </Field>
        <Field id="na" label="Answer">
          <textarea id="na" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className="field mt-1.5 py-2.5 leading-[22px]" />
        </Field>
        <Field id="nc" label="Category">
          <input id="nc" list="faq-cats" value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1.5 h-11" />
          <datalist id="faq-cats">
            {lib.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        {error && (
          <p role="alert" className="text-[13px] leading-[18px] text-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || question.trim().length < 3 || answer.trim().length < 3} className="btn-moss w-full">
          {busy ? "Adding" : "Add to FAQ"}
        </button>
        <div role="status" aria-live="polite">
          {done && (
            <p key={done} className="anim-fade flex items-center gap-2 text-[14px] font-medium leading-5 text-moss">
              <span aria-hidden="true" className="anim-pop grid h-5 w-5 shrink-0 place-items-center rounded-full bg-moss text-white">
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
      <label htmlFor={id} className="block text-[14px] font-medium leading-5">
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
