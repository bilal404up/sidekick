import { isHelpRequest, smallTalk, stripPleasantries, tokens } from "./text";
import { buildIndex, search, bestMatch, MIN_COVERAGE, type Faq, type Index, type Match } from "./retrieve";
import { askModel, NOT_FOUND_MARKER, type LlmConfig } from "../llm";

export type Mode = "faq" | "model" | "model-fallback" | "none";

export interface Reply {
  kind: "answer" | "unknown" | "smalltalk";
  text: string;
  /** FAQ entries the reply is based on. Empty for unknown and small talk. */
  sources: Array<{ id: string; question: string }>;
  mode: Mode;
  /** Answers only. One line in the assistant's own words, shown above the answer. It never states a fact. */
  headline?: string;
  /** Answers only. Other FAQ questions close to this one, offered as follow-ups. Questions, never answers. */
  related?: string[];
  /** Answers only. "partial" when meaningful words of the question are not in the matched entry. */
  coverage?: "full" | "partial";
  /** Partial answers only. Says which words of the question the entry does not mention. */
  note?: string;
  /** Answers only. What the match rests on, so a customer can check it: matched word stems, strength and the cutoff. */
  match?: { stems: string[]; strength: number; threshold: number };
  /** AI mode only. The matched entry word for word, so the reworded answer can be checked against it. */
  card?: { question: string; answer: string; category?: string };
}

export const SUPPORT_EMAIL = "support@fernbrook.example";

export const UNKNOWN_TEXT = `That isn't in our FAQ, so I won't guess. I've passed your question to the team, and you can also email ${SUPPORT_EMAIL}.`;

export const MAX_QUESTION_LENGTH = 500;

/** Below this coverage the entry may leave part of the question unanswered. Framing only; retrieval is unchanged. */
const FULL_COVERAGE = 0.85;
/** Other matches at or above this coverage are offered as related questions. */
const RELATED_MIN = 0.3;

const FOUND = ["Found it in the FAQ.", "The FAQ covers this.", "Here's what the FAQ says."];

/** Words with no meaning of their own, never named in a partial-answer note. */
const NOTE_FILLER = new Set(
  tokens("what's how's where's who's that's there's don't doesn't didn't can't won't isn't aren't i'm i've you're okay ok hi hello hey also really actually thanks thank")
);

/**
 * Common wordings that keyword matching misses, mapped to the plain question they mean.
 * A route is tried only when the customer's own words match nothing, and it is used only if the
 * mapped question matches an FAQ entry strongly. The answer always comes from that entry.
 */
interface Route {
  test: RegExp;
  query: string;
  headline: string;
  /** Name the trigger word in the partial note, e.g. "PayPal" when the payment entry doesn't list it. */
  flagTrigger?: boolean;
}

const ROUTES: Route[] = [
  {
    test: /\b(?:useless|not helpful|not helping|unhelpful|stupid|frustrat\w*|annoy\w*|ridiculous|waste of (?:my )?time)\b/i,
    query: "How can I contact a person?",
    headline: "Sorry this isn't helping. Here's how to reach a person.",
  },
  {
    test: /\b(?:human|real person|live agent|someone real|customer service|representative|operator)\b|\b(?:talk|speak|chat)\b.*\b(?:person|someone|somebody|agent|staff|team)\b/i,
    query: "How can I contact a person?",
    headline: "Here's how to reach a person.",
  },
  {
    test: /\b(?:phone number|call you|email address|your email|contact you|reach you|get in touch)\b/i,
    query: "How can I contact a person?",
    headline: "Here's how to reach the team.",
  },
  {
    test: /\b(?:postage|delivery (?:cost|fee|charge|price)|shipping (?:fee|charge|price))\b/i,
    query: "How much does shipping cost?",
    headline: "I read that as a question about shipping costs.",
  },
  {
    test: /\b(?:package|parcel|shipment|delivery)\b/i,
    query: "Where is my order?",
    headline: "I read that as a question about where your order is.",
  },
  {
    test: /\bmoney back\b|\brefund\b/i,
    query: "Can I get a refund?",
    headline: "I read that as a question about refunds.",
  },
  {
    test: /\b(?:paypal|credit card|debit card|venmo|cash app|klarna|afterpay|pay with|payment options)\b/i,
    query: "What payment methods do you accept?",
    headline: "I read that as a question about payment methods.",
    flagTrigger: true,
  },
];

interface Found {
  top: Match;
  matches: Match[];
  query: string;
  route?: Route;
}

function findMatch(index: Index, question: string): Found | null {
  const query = stripPleasantries(question);
  const matches = search(index, query, 3);
  const top = bestMatch(matches);
  if (top) return { top, matches, query };
  const route = ROUTES.find((r) => r.test.test(query));
  if (!route) return null;
  const routed = search(index, route.query, 3);
  const best = bestMatch(routed);
  return best && best.coverage >= FULL_COVERAGE ? { top: best, matches: routed, query: route.query, route } : null;
}

function helpText(faqs: Faq[]): string {
  const topics = Array.from(new Set(faqs.map((f) => f.category?.trim()).filter((c): c is string => Boolean(c))));
  const list = topics.length ? `${topics.slice(0, -1).join(", ")}${topics.length > 1 ? " and " : ""}${topics[topics.length - 1]}` : "shipping, returns, orders and plant care";
  return `I answer questions from the shop's FAQ. It covers ${list}. Ask me anything in those areas, and if the FAQ doesn't cover it, I'll pass your question to the team.`;
}

function pick(list: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

function quoteList(words: string[]): string {
  const q = words.map((w) => `\u201C${w}\u201D`);
  return q.length <= 1 ? q.join("") : `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}`;
}

/** The assistant's framing around an entry. It describes the match; it never adds to the answer. */
function framing(found: Found, original: string, mode: Mode): Pick<Reply, "headline" | "coverage" | "note" | "related" | "match"> {
  const { top, matches, query, route } = found;
  const faq = top.faq;
  const onEntry = new Set(tokens(`${faq.question} ${faq.keywords ?? ""} ${faq.answer}`));
  const stems = Array.from(new Set([...tokens(query), ...tokens(original)])).filter((t) => onEntry.has(t));

  const missing: string[] = [];
  const checkMissing = route ? Boolean(route.flagTrigger) : top.coverage < FULL_COVERAGE;
  if (checkMissing) {
    const seen = new Set<string>();
    for (const word of (route ? original : query).match(/[A-Za-z0-9']+/g) ?? []) {
      const t = tokens(word)[0];
      if (!t || onEntry.has(t) || NOTE_FILLER.has(t) || seen.has(t)) continue;
      seen.add(t);
      missing.push(word);
      if (missing.length === 3) break;
    }
  }
  const partial = missing.length > 0;
  const related = matches
    .filter((m) => m !== top && m.coverage >= RELATED_MIN && m.faq.question !== faq.question)
    .map((m) => m.faq.question)
    .slice(0, 2);

  return {
    headline: route?.headline ?? (partial ? "The FAQ covers part of this." : mode === "model" ? "Here it is in plain words, from one FAQ entry." : pick(FOUND, faq.id)),
    coverage: partial ? "partial" : "full",
    ...(partial ? { note: `The FAQ entry doesn't mention ${quoteList(missing)}, so I can't answer that part. You can ask the team at ${SUPPORT_EMAIL}.` } : {}),
    ...(related.length > 0 ? { related } : {}),
    match: { stems, strength: Math.round(top.coverage * 100) / 100, threshold: MIN_COVERAGE },
  };
}

export async function respond(
  rawQuestion: string,
  faqs: Faq[],
  opts: { llm?: LlmConfig | null; index?: Index; fetchImpl?: typeof fetch } = {}
): Promise<Reply> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);

  if (isHelpRequest(question)) return { kind: "smalltalk", text: helpText(faqs), sources: [], mode: "none" };
  const chat = smallTalk(question);
  if (chat) return { kind: "smalltalk", text: chat, sources: [], mode: "none" };

  const index = opts.index ?? buildIndex(faqs);
  const found = findMatch(index, question);
  if (!found) return { kind: "unknown", text: UNKNOWN_TEXT, sources: [], mode: "none" };

  const { top } = found;
  const sources = [{ id: top.faq.id, question: top.faq.question }];

  if (opts.llm) {
    try {
      // The model sees the customer's words and the one matched entry, nothing else.
      const out = await askModel(opts.llm, question, [top.faq], opts.fetchImpl);
      if (out && out.includes(NOT_FOUND_MARKER)) return { kind: "unknown", text: UNKNOWN_TEXT, sources: [], mode: "model" };
      if (out) {
        return {
          kind: "answer",
          text: out,
          sources,
          mode: "model",
          ...framing(found, question, "model"),
          card: { question: top.faq.question, answer: top.faq.answer, ...(top.faq.category ? { category: top.faq.category } : {}) },
        };
      }
    } catch {
      return { kind: "answer", text: top.faq.answer, sources, mode: "model-fallback", ...framing(found, question, "model-fallback") };
    }
  }
  return { kind: "answer", text: top.faq.answer, sources, mode: "faq", ...framing(found, question, "faq") };
}
