/**
 * Entries that share a category and exactly the same answer are one answer asked several ways.
 * The best-written question is the main entry; the others are wordings the owner taught.
 * Presentation only: nothing is stored differently.
 */
export function aliasMap<T extends { id: string; question: string; answer: string; category?: string | null }>(faqs: T[]): Map<string, string> {
  const groups = new Map<string, T[]>();
  for (const f of faqs) {
    const key = `${(f.category ?? "").trim().toLowerCase()}\n${f.answer.trim()}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const score = (q: string) => (/^[A-Z]/.test(q.trim()) ? 2 : 0) + (/\?\s*$/.test(q) ? 1 : 0);
  const alias = new Map<string, string>();
  groups.forEach((list) => {
    if (list.length < 2) return;
    const main = list.reduce((best, f) => (score(f.question) > score(best.question) ? f : best), list[0]);
    for (const f of list) if (f.id !== main.id) alias.set(f.id, main.id);
  });
  return alias;
}
