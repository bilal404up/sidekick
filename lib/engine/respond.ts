import { smallTalk, tokens } from "./text";
import { buildIndex, search, bestMatch, type Faq, type Index, type Match } from "./retrieve";
import { askModel, NOT_FOUND_MARKER, type LlmConfig } from "../llm";

export type Mode = "faq" | "model" | "model-fallback" | "none";

export interface Reply {
  kind: "answer" | "unknown" | "smalltalk";
  text: string;
  /** FAQ entries the reply is based on. Empty for unknown and small talk. */
  sources: Array<{ id: string; question: string }>;
  mode: Mode;
  /** Answers only. One line in the assistant's own words, shown above the card. It never states a fact. */
  headline?: string;
  /** Answers only. Other FAQ questions close to this one, offered as follow-ups. Questions, never answers. */
  related?: string[];
  /** Answers only. "partial" when meaningful words of the question are not on the matched card. */
  coverage?: "full" | "partial";
  /** Partial answers only. Says which words of the question the card does not mention. */
  note?: string;
  /** AI mode only. The matched card word for word, so the reworded answer can be checked against it. */
  card?: { question: string; answer: string; category?: string };
}

export const SUPPORT_EMAIL = "support@fernbrook.example";

export const UNKNOWN_TEXT = `That isn't in our help file, so I won't guess. I've saved your question for the team, and you can also email ${SUPPORT_EMAIL}.`;

export const MAX_QUESTION_LENGTH = 500;

/** Below this coverage the card may leave part of the question unanswered. Framing only; retrieval is unchanged. */
const FULL_COVERAGE = 0.85;
/** Other matches at or above this coverage are offered as related questions. */
const RELATED_MIN = 0.3;

const FOUND = ["Found it in the help file.", "This one is on file.", "Here is the card for that."];

/** Words that carry no meaning of their own, so they are never named in a partial-answer note. */
const NOTE_FILLER = new Set(
  tokens("what's how's where's who's that's there's don't doesn't didn't can't won't isn't aren't i'm i've you're okay ok hi hello hey also really actually thanks thank")
);

function pick(list: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

function listWords(words: string[]): string {
  const q = words.map((w) => `\u201C${w}\u201D`);
  if (q.length <= 1) return q.join("");
  return `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}`;
}

/** Words of the question that the matched card never mentions, as the customer typed them. */
function missingWords(question: string, faq: Faq): string[] {
  const onCard = new Set(tokens(`${faq.question} ${faq.keywords ?? ""} ${faq.answer}`));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of question.match(/[A-Za-z0-9']+/g) ?? []) {
    const t = tokens(word)[0];
    if (!t || onCard.has(t) || NOTE_FILLER.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(word);
  }
  return out.slice(0, 3);
}

/** The assistant's framing around a card. It describes the match; it never adds to the answer. */
function framing(top: Match, matches: Match[], question: string, mode: Mode): Pick<Reply, "headline" | "coverage" | "note" | "related"> {
  const missing = top.coverage < FULL_COVERAGE ? missingWords(question, top.faq) : [];
  const partial = missing.length > 0;
  const related = matches
    .filter((m) => m !== top && m.coverage >= RELATED_MIN && m.faq.question !== top.faq.question)
    .map((m) => m.faq.question)
    .slice(0, 2);

  const headline = partial
    ? "The help file covers part of this."
    : mode === "model"
      ? "Here it is in plain words, taken from this card only."
      : pick(FOUND, top.faq.id);

  return {
    headline,
    coverage: partial ? "partial" : "full",
    ...(partial ? { note: `This card doesn't mention ${listWords(missing)}, so I can't answer that part. You can ask the team at ${SUPPORT_EMAIL}.` } : {}),
    ...(related.length > 0 ? { related } : {}),
  };
}

export async function respond(
  rawQuestion: string,
  faqs: Faq[],
  opts: { llm?: LlmConfig | null; index?: Index; fetchImpl?: typeof fetch } = {}
): Promise<Reply> {
  const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);

  const chat = smallTalk(question);
  if (chat) return { kind: "smalltalk", text: chat, sources: [], mode: "none" };

  const index = opts.index ?? buildIndex(faqs);
  const matches = search(index, question, 3);
  const top = bestMatch(matches);
  if (!top) return { kind: "unknown", text: UNKNOWN_TEXT, sources: [], mode: "none" };

  const sources = [{ id: top.faq.id, question: top.faq.question }];

  if (opts.llm) {
    try {
      // The model is given the one matched card and nothing else, so "from this card only" is literally true.
      const out = await askModel(opts.llm, question, [top.faq], opts.fetchImpl);
      if (out && out.includes(NOT_FOUND_MARKER)) return { kind: "unknown", text: UNKNOWN_TEXT, sources: [], mode: "model" };
      if (out) {
        return {
          kind: "answer",
          text: out,
          sources,
          mode: "model",
          ...framing(top, matches, question, "model"),
          card: { question: top.faq.question, answer: top.faq.answer, ...(top.faq.category ? { category: top.faq.category } : {}) },
        };
      }
    } catch {
      return { kind: "answer", text: top.faq.answer, sources, mode: "model-fallback", ...framing(top, matches, question, "model-fallback") };
    }
  }
  return { kind: "answer", text: top.faq.answer, sources, mode: "faq", ...framing(top, matches, question, "faq") };
}
