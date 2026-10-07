const STOP = new Set(
  (
    "a an and are as at be but by can could do does for from had has have how i if in into is it its me my of on or our so than that the their them then there these they this to us was we were what when where which who why will with would you your please tell about know get got want need like just any some take give"
  ).split(" ")
);

/** Light stemming: enough to match "returns" with "return" and "shipping" with "ship". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Lowercased, stop words removed, stemmed. Order is kept; duplicates are kept. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/'/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

const SMALL_TALK: Array<{ test: RegExp; reply: string }> = [
  { test: /^(hi|hello|hey|hiya|good (morning|afternoon|evening))\b[\s!.?]*$/i, reply: "Hi, I'm the Fernbrook shop assistant. Ask me about shipping, returns, orders or plant care." },
  { test: /^(thanks|thank you|thx|cheers)\b[\s!.?a-z]*$/i, reply: "You're welcome. Ask me anything else about the shop." },
  { test: /^(bye|goodbye|see you)\b[\s!.?a-z]*$/i, reply: "Goodbye. I'm here whenever you have another question." },
];

export function smallTalk(text: string): string | null {
  const t = text.trim();
  for (const s of SMALL_TALK) if (s.test.test(t)) return s.reply;
  return null;
}
