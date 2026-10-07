/**
 * Checks what the PUBLIC key can do. Run with `npm run check:exposure`.
 * All Sidekick tables are server-only: the public key must read nothing and write nothing.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!anon) {
  console.error("Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to run this check.");
  process.exit(2);
}
const sb = createClient(url, anon, { auth: { persistSession: false } });

async function main() {
  let bad = 0;
  for (const table of ["sk_faq", "sk_conversations", "sk_messages", "sk_unanswered"]) {
    const read = await sb.from(table).select("*").limit(1);
    const readable = !read.error && (read.data?.length ?? 0) > 0;
    const write = await sb.from(table).insert(table === "sk_faq" ? { question: "exposure check", answer: "exposure check" } : table === "sk_conversations" ? { session_id: "exposure-check" } : {} as never);
    const writable = !write.error;
    console.log(`${readable || writable ? "EXPOSED  " : "protected"} ${table}  read=${readable} write=${writable}`);
    if (readable || writable) bad++;
  }
  process.exit(bad ? 1 : 0);
}
main();
