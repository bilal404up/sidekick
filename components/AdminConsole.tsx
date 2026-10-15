"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnswerText } from "@/components/AnswerText";
import { respond, type Reply } from "@/lib/engine/respond";
import { buildIndex, search, type Faq, type Index } from "@/lib/engine/retrieve";
import { aliasMap } from "@/lib/faqGroups";

export interface UnansweredItem { id: string; question: string; created_at: string }
export interface ConversationItem { id: string; created_at: string; is_sample: boolean; messages: number; unanswered: number; first_question: string | null }
export interface FaqItem { id: string; category: string; question: string; answer: string }
interface Message { id: string; role: "user" | "bot"; content: string; kind: string | null; mode: string | null; created_at: string }

type Tab = "inbox" | "train" | "conversations" | "faq";
type Logged = { key: string; text: string; how: "Answered" | "Taught" | "Added" };

const REVIEWED_KEY = "sidekick.train.reviewed";
const SEEN_KEY = "sidekick.train.seen";
const TRANSCRIPTS = 20;

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const quoted = (s: string) => `\u201C${s}\u201D`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
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

/** Everything derived from the FAQ list: the same search index the assistant uses, main entries and taught wordings. */
interface Library {
  index: Index;
  byId: Map<string, FaqItem>;
  mainOf: (id: string) => string;
  mains: FaqItem[];
  wordings: Map<string, FaqItem[]>;
  categories: string[];
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
    };
  }, [faqs]);
}

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
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const ready = useRef(false);
  useEffect(() => {
    ready.current = true;
  }, []);

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

  const tabs: Array<{ key: Tab; label: string; count: number | null; tone: string }> = [
    { key: "inbox", label: "Inbox", count: inbox.length, tone: inbox.length ? "bg-asked-soft text-asked-dark" : "bg-canvas text-ink-muted" },
    { key: "train", label: "Train", count: toReview, tone: toReview ? "bg-ink text-white" : "bg-canvas text-ink-muted" },
    { key: "conversations", label: "Conversations", count: conversations.length, tone: "bg-canvas text-ink-muted" },
    { key: "faq", label: "FAQ", count: lib.mains.length, tone: "bg-found-soft text-found-dark" },
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
              onClick={() => select(t.key)}
              className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[15px] font-semibold ${on ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {t.label}
              {t.count !== null && (
                <span key={`${t.key}-${t.count}`} className={`inline-block rounded-full px-2 py-0.5 text-[12px] leading-4 ${t.tone} ${ready.current ? "anim-bump" : ""}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-6">
        {tab === "inbox" && (
          <div role="tabpanel" id="panel-inbox" aria-labelledby="tab-inbox">
            <Inbox
              items={inbox}
              lib={lib}
              notice={notice}
              wordingCount={faqs.length - lib.mains.length}
              session={session}
              animate={ready.current}
              onDone={onInboxDone}
            />
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
    </div>
  );
}

/* ---------- Inbox ---------- */

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
                lib={lib}
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
          <p className="text-[13px] leading-[18px] text-ink-muted">Answers in the FAQ</p>
          <p key={lib.mains.length} className={`mt-1 inline-block text-[32px] font-semibold leading-none tracking-tight ${animate ? "anim-bump" : ""}`}>
            {lib.mains.length}
          </p>
          {wordingCount > 0 && (
            <p className="mt-2 text-[13px] leading-[18px] text-ink-muted">
              Plus {wordingCount} taught {wordingCount === 1 ? "wording" : "wordings"}.
            </p>
          )}
          <p className="mt-3 text-[13px] leading-[18px] text-ink-muted">Answers you add are used from the next question on. There is nothing to publish.</p>
        </div>
        {session.length > 0 && (
          <div className="panel p-4">
            <h2 className="text-[15px] leading-5 tracking-normal">This session</h2>
            <ul className="mt-2 space-y-2">
              {session.map((s) => (
                <li key={s.key} className="anim-rise flex gap-2 text-[14px] leading-5">
                  <span aria-hidden="true" className="dot mt-1.5 bg-found" />
                  <span>
                    <span className="font-semibold">{s.how}: </span>
                    {s.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function InboxCard({ u, lib, onDone }: { u: UnansweredItem; lib: Library; onDone: (action: "add" | "dismiss") => void }) {
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("General");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"add" | "dismiss" | null>(null);
  const [phase, setPhase] = useState<"idle" | "added" | "leaving">("idle");
  const suggestions = useMemo(() => closest(lib, u.question).slice(0, 2), [lib, u.question]);
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
            {suggestions.length > 0 && (
              <div className="mb-3">
                <p className="text-[12px] leading-4 text-ink-muted">Similar entries already in the FAQ</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAnswer(s.answer);
                        setCategory(s.category);
                      }}
                      className="chip"
                    >
                      Use the answer from {quoted(s.question)}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                  {lib.categories.map((c) => (
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[60ch] text-[14px] leading-[21px] text-ink-muted">
            Every question customers asked, newest first, with what the assistant answers today. When it&apos;s wrong, teach it.
          </p>
          <div role="group" aria-label="Show" className="inline-flex rounded-md border border-rule bg-surface p-0.5">
            <Seg on={filter === "todo"} onClick={() => setFilter("todo")}>
              To review{items ? ` (${todo.length})` : ""}
            </Seg>
            <Seg on={filter === "all"} onClick={() => setFilter("all")}>
              All
            </Seg>
          </div>
        </div>
        {items === null ? (
          <p role="status" className="flex items-center gap-2 text-[14px] leading-5 text-ink-muted">
            <span aria-hidden="true" className="typing inline-flex gap-1">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            Reading recent conversations ({progress} of {total})
          </p>
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule-strong p-6">
            <h2 className="text-[22px] leading-7">{rows.length ? "All reviewed." : "No questions yet."}</h2>
            <p className="mt-1.5 text-[15px] leading-[22px] text-ink-muted">New questions show up here as customers ask them.</p>
          </div>
        ) : (
          <ul className="space-y-3">
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
        {limited && <p className="mt-4 text-[13px] leading-[18px] text-ink-muted">Some conversations weren&apos;t read because of the rate limit. Reload in a minute to see more.</p>}
      </div>
      <aside aria-label="How training works" className="panel h-fit space-y-3 p-4 text-[14px] leading-[21px] text-ink-muted lg:sticky lg:top-6">
        <h2 className="text-[15px] leading-5 tracking-normal text-ink">How training works</h2>
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
    <li className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4 text-ink-muted">
        {isNew && <span className="rounded-full bg-ink px-2 py-0.5 font-semibold text-white">New</span>}
        <span>Asked {when(item.at)}</span>
        {item.times > 1 && <span>{item.times} times</span>}
        {reviewed && <span className="rounded-full bg-canvas px-2 py-0.5 ring-1 ring-rule">Reviewed</span>}
      </div>
      <p className="mt-1.5 text-[16px] font-semibold leading-6">{quoted(item.text)}</p>
      <p className="mt-2 flex items-start gap-2 text-[14px] leading-5">
        {reply === undefined ? (
          <span className="text-ink-muted">Checking what it answers</span>
        ) : current ? (
          <>
            <span aria-hidden="true" className="dot mt-1.5 bg-found" />
            <span>
              <span className="text-ink-muted">Answers with </span>
              <span className="font-semibold">{current.question}</span>
            </span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="dot mt-1.5 bg-asked" />
            <span className="text-asked-dark">Not in the FAQ{inboxItem ? ", waiting in the inbox" : ""}</span>
          </>
        )}
      </p>

      {done ? (
        <p role="status" className="anim-fade mt-4 flex items-center gap-2 text-[15px] font-semibold leading-[22px] text-found">
          <span aria-hidden="true" className="anim-pop grid h-6 w-6 shrink-0 place-items-center rounded-full bg-found text-white">
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
          <button type="button" onClick={start} className={current ? "btn-quiet" : "btn-found"}>
            {current ? "Teach a better answer" : "Teach it"}
          </button>
          {!current && !reviewed && (
            <button type="button" onClick={() => onReviewed(item.key)} className="btn-quiet">
              Skip
            </button>
          )}
        </div>
      ) : (
        <div className="anim-fade mt-4 rounded-lg border border-rule bg-canvas p-3 sm:p-4">
          <div role="group" aria-label="How to teach it" className="inline-flex flex-wrap rounded-md border border-rule bg-surface p-0.5">
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
                  <legend className="text-[13px] font-semibold leading-[18px]">Closest entries</legend>
                  <div className="mt-2 space-y-2">
                    {suggestions.map((s) => (
                      <label
                        key={s.id}
                        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3 text-[14px] leading-5 ${chosenId === s.id ? "border-found" : "border-rule hover:border-rule-strong"}`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-pick`}
                          value={s.id}
                          checked={chosenId === s.id}
                          onChange={() => setChosenId(s.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#117A4A]"
                        />
                        <span className="font-semibold">{s.question}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div>
                <label htmlFor={`${uid}-any`} className="block text-[13px] font-semibold leading-[18px]">
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
                            {f.question}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {chosen && (
                <div className="rounded-lg bg-surface p-3 ring-1 ring-rule">
                  <p className="text-[12px] font-semibold leading-4 text-ink-muted">Customers who ask this will get</p>
                  <AnswerText text={chosen.answer} className="mt-1.5 text-[14px] leading-[21px]" />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor={`${uid}-new`} className="block text-[13px] font-semibold leading-[18px]">
                  Answer customers should get
                </label>
                <textarea id={`${uid}-new`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="field mt-1.5 py-2.5 leading-[22px]" />
              </div>
              <div>
                <label htmlFor={`${uid}-cat`} className="block text-[13px] font-semibold leading-[18px]">
                  Category
                </label>
                <input id={`${uid}-cat`} list={`${uid}-cats`} value={category} onChange={(e) => setCategory(e.target.value)} className="field mt-1.5 h-11 w-56" />
                <datalist id={`${uid}-cats`}>
                  {lib.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {exists && (
            <p className="mt-3 text-[13px] leading-[18px] text-asked-dark">
              This exact wording is already an FAQ entry, so there&apos;s nothing to teach. Change or delete that entry in the FAQ tab instead.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[13px] leading-[18px] text-error">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={pending || exists || answer.length < 3} className="btn-found">
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
    <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-11 rounded px-3 text-[13px] font-semibold ${on ? "bg-ink text-white" : "text-ink-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

/* ---------- Conversations ---------- */

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
                    const extra = lib.wordings.get(f.id) ?? [];
                    const isNew = newKey !== null && [f, ...extra].some((x) => norm(x.question) === newKey);
                    return (
                      <li key={f.id} className={`px-4 py-3 ${isNew ? "is-new anim-rise" : ""}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold leading-[22px]">{f.question}</p>
                            <AnswerText text={f.answer} className="mt-1 text-[14px] leading-[21px] text-ink-muted" />
                          </div>
                          <button type="button" onClick={() => remove(f.id, false)} className="btn-quiet shrink-0 text-error">
                            Delete
                          </button>
                        </div>
                        {extra.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[12px] font-semibold leading-4 text-ink-muted">Also asked as</p>
                            <ul className="mt-1">
                              {extra.map((w) => (
                                <li key={w.id} className="flex items-center justify-between gap-3 text-[14px] leading-5">
                                  <span className="min-w-0">{quoted(w.question)}</span>
                                  <button type="button" onClick={() => remove(w.id, true)} className="btn-quiet shrink-0">
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
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
