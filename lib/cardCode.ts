/**
 * Presentation helper only. Turns an FAQ question into a stable four digit card number,
 * so the customer and the owner see the same number for the same card. No data is stored.
 */
export function cardNumber(question: string): string {
  const s = question.trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % 10000).padStart(4, "0");
}

/** Window event the chat sends when it pulls a card or files a question. */
export const FILE_EVENT = "sidekick:file";

export type FileEventDetail = { kind: "answer"; code: string } | { kind: "unknown" };
