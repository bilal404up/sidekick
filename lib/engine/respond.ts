import { smallTalk } from "./text";
import { buildIndex, search, bestMatch, type Faq, type Index } from "./retrieve";
import { askModel, NOT_FOUND_MARKER, type LlmConfig } from "../llm";

export type Mode = "faq" | "model" | "model-fallback" | "none";

export interface Reply {
  kind: "answer" | "unknown" | "smalltalk";
  text: string;
  /** FAQ entries the reply is based on. Empty for unknown and small talk. */
  sources: Array<{ id: string; question: string }>;
  mode: Mode;
}

export const UNKNOWN_TEXT =
  "I can't find that in our help pages, so I won't guess. I've saved your question for the team. You can also email support@fernbrook.example.";

export const MAX_QUESTION_LENGTH = 500;

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
      // Only entries that cleared the bar are passed to the model.
      const passages = matches.filter((m) => m.coverage >= top.coverage * 0.8).map((m) => m.faq);
      const out = await askModel(opts.llm, question, passages, opts.fetchImpl);
      if (out && out.includes(NOT_FOUND_MARKER)) return { kind: "unknown", text: UNKNOWN_TEXT, sources: [], mode: "model" };
      if (out) return { kind: "answer", text: out, sources, mode: "model" };
    } catch {
      return { kind: "answer", text: top.faq.answer, sources, mode: "model-fallback" };
    }
  }
  return { kind: "answer", text: top.faq.answer, sources, mode: "faq" };
}
