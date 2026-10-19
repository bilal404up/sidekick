/**
 * Citation numbers for FAQ entries: §01, §02 and so on.
 * Display only. Numbers follow category order, then question order, as the list arrives
 * (the store sorts by category, then creation time). Taught wordings share their main entry's number.
 * Nothing is stored; a number can shift when entries are added or removed.
 */
export interface Cite {
  n: number;
  category: string;
}

export function citeMap(faqs: Array<{ id: string; category?: string | null; aliasOf?: string }>, aliases?: Map<string, string>): Record<string, Cite> {
  const aliasOf = (f: { id: string; aliasOf?: string }) => f.aliasOf ?? aliases?.get(f.id);
  const groups = new Map<string, string[]>();
  for (const f of faqs) {
    if (aliasOf(f)) continue;
    const cat = f.category || "General";
    groups.set(cat, [...(groups.get(cat) ?? []), f.id]);
  }
  const out: Record<string, Cite> = {};
  let n = 0;
  groups.forEach((ids, category) => {
    for (const id of ids) out[id] = { n: ++n, category };
  });
  for (const f of faqs) {
    const main = aliasOf(f);
    if (main && out[main]) out[f.id] = out[main];
  }
  return out;
}

export const citeLabel = (n: number) => `§${String(n).padStart(2, "0")}`;
