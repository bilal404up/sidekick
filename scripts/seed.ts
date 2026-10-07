/**
 * Seed script: run once with `npm run seed` after applying supabase/schema.sql.
 * Inserts the sample FAQ and a week of sample conversations, all invented.
 * Replies in the sample conversations are produced by the real answer engine.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { FAQ_SEED } from "../lib/faq-data";
import { respond } from "../lib/engine/respond";
import type { Faq } from "../lib/engine/retrieve";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Each inner list is one conversation: what the customer typed, in order.
const CONVERSATIONS: string[][] = [
  ["how much is shipping", "ok and how long does it take"],
  ["do you ship to canada"],
  ["can i return a plant that died", "how do i start a return", "when will i get my refund"],
  ["where is my order"],
  ["how often should i water my cactus"],
  ["do you sell fertilizer", "what about plant food"],
  ["are your seeds organic", "do you sell gift cards"],
  ["do you have a loyalty program"],
  ["my tomatoes have yellow leaves, why", "how much sun do tomatoes need"],
  ["is the potting soil peat free"],
  ["can i cancel my order", "i want a discount code"],
  ["hello", "do you offer plant subscriptions"],
];

async function main() {
  const { count } = await sb.from("sk_faq").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log(`The FAQ already has ${count} entries. Nothing seeded.`);
    return;
  }

  const { error: faqErr } = await sb.from("sk_faq").insert(FAQ_SEED.map((f) => ({ category: f.category, question: f.question, answer: f.answer, keywords: f.keywords ?? "" })));
  if (faqErr) throw faqErr;
  const { data: rows, error } = await sb.from("sk_faq").select("id, category, question, answer, keywords");
  if (error || !rows) throw error;
  const faqs = rows as Faq[];

  let n = 0;
  for (const turns of CONVERSATIONS) {
    const start = Date.now() - (6 - (n % 6)) * 86_400_000 - n * 1_800_000;
    const { data: conv, error: cErr } = await sb.from("sk_conversations").insert({ session_id: `sample-${n}`, is_sample: true, created_at: new Date(start).toISOString() }).select("id").single();
    if (cErr || !conv) throw cErr;
    let t = start;
    for (const q of turns) {
      const reply = await respond(q, faqs);
      await sb.from("sk_messages").insert({ conversation_id: conv.id, role: "user", content: q, created_at: new Date((t += 20_000)).toISOString() });
      await sb.from("sk_messages").insert({
        conversation_id: conv.id,
        role: "bot",
        content: reply.text,
        kind: reply.kind,
        mode: reply.mode,
        faq_id: reply.sources[0]?.id ?? null,
        created_at: new Date((t += 2_000)).toISOString(),
      });
      if (reply.kind === "unknown") await sb.from("sk_unanswered").insert({ conversation_id: conv.id, question: q, created_at: new Date(t).toISOString() });
    }
    n++;
  }
  console.log(`Seeded ${faqs.length} FAQ entries and ${n} sample conversations.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
