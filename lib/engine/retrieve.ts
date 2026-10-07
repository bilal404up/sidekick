import { tokens } from "./text";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category?: string;
  keywords?: string;
}

export interface Match {
  faq: Faq;
  /** BM25 score, used for ranking only. */
  score: number;
  /** Share of the question's meaningful words (weighted by rarity) found in this entry, 0 to 1. */
  coverage: number;
}

/** Entries below this coverage are treated as "not in the FAQ". Tuned against tests/engine.test.ts. */
export const MIN_COVERAGE = 0.6;

const K1 = 1.4;
const B = 0.75;

interface Doc {
  faq: Faq;
  tf: Map<string, number>;
  len: number;
}

export function buildIndex(faqs: Faq[]) {
  const docs: Doc[] = faqs.map((faq) => {
    // The question counts three times, keywords twice, the answer once.
    const toks = [
      ...tokens(faq.question), ...tokens(faq.question), ...tokens(faq.question),
      ...tokens(faq.keywords ?? ""), ...tokens(faq.keywords ?? ""),
      ...tokens(faq.answer),
    ];
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { faq, tf, len: toks.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  const idf = (t: string) => {
    const n = df.get(t) ?? 0;
    return Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
  };
  return { docs, idf, avgLen, size: docs.length };
}

export type Index = ReturnType<typeof buildIndex>;

export function search(index: Index, question: string, limit = 3): Match[] {
  const q = Array.from(new Set(tokens(question)));
  if (q.length === 0 || index.size === 0) return [];
  // Rare words weigh more. Words the FAQ has never seen weigh the most and can never match, so a
  // question full of unknown words cannot pass because one common word matched.
  const weight = (t: string) => index.idf(t);
  const totalWeight = q.reduce((s, t) => s + weight(t), 0);

  const matches: Match[] = index.docs.map((d) => {
    let score = 0;
    let matched = 0;
    for (const t of q) {
      const f = d.tf.get(t) ?? 0;
      if (f === 0) continue;
      const idf = index.idf(t);
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / index.avgLen)));
      matched += weight(t);
    }
    return { faq: d.faq, score, coverage: matched / totalWeight };
  });
  return matches
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** The best match, only if it clears the coverage bar. */
export function bestMatch(matches: Match[]): Match | null {
  const top = matches[0];
  return top && top.coverage >= MIN_COVERAGE ? top : null;
}
