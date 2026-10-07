import { db } from "./supabase";
import type { Faq } from "./engine/retrieve";
import type { Reply } from "./engine/respond";

const HOUR_MS = 60 * 60 * 1000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

export async function activeFaqs(): Promise<Faq[]> {
  const { data, error } = await db().from("sk_faq").select("id, category, question, answer, keywords").eq("active", true).order("created_at");
  if (error) throw error;
  return (data ?? []) as Faq[];
}

/** One conversation per browser session per day. */
export async function conversationFor(sessionId: string, ipHash: string): Promise<string> {
  const { data } = await db()
    .from("sk_conversations")
    .select("id")
    .eq("session_id", sessionId)
    .gte("created_at", iso(24 * HOUR_MS))
    .order("created_at", { ascending: false })
    .limit(1);
  if (data && data[0]) return data[0].id as string;
  const { data: created, error } = await db().from("sk_conversations").insert({ session_id: sessionId, ip_hash: ipHash }).select("id").single();
  if (error) throw error;
  return created.id as string;
}

async function countUserMessages(column: "session_id" | "ip_hash", value: string): Promise<number> {
  const { data: convs } = await db().from("sk_conversations").select("id").eq(column, value).gte("created_at", iso(24 * HOUR_MS));
  const ids = (convs ?? []).map((c) => c.id as string);
  if (ids.length === 0) return 0;
  const { count } = await db()
    .from("sk_messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", ids)
    .eq("role", "user")
    .gte("created_at", iso(HOUR_MS));
  return count ?? 0;
}

export async function recentCounts(sessionId: string, ipHash: string) {
  const [session, ip] = await Promise.all([countUserMessages("session_id", sessionId), countUserMessages("ip_hash", ipHash)]);
  return { session, ip };
}

export async function saveExchange(conversationId: string, question: string, reply: Reply) {
  const { data: userMsg, error } = await db()
    .from("sk_messages")
    .insert({ conversation_id: conversationId, role: "user", content: question })
    .select("id")
    .single();
  if (error) throw error;
  await db().from("sk_messages").insert({
    conversation_id: conversationId,
    role: "bot",
    content: reply.text,
    kind: reply.kind,
    mode: reply.mode,
    faq_id: reply.sources[0]?.id ?? null,
  });
  if (reply.kind === "unknown") {
    await db().from("sk_unanswered").insert({ conversation_id: conversationId, question });
  }
  return userMsg.id as string;
}

// ---------- admin ----------
export interface ConversationRow {
  id: string;
  created_at: string;
  is_sample: boolean;
  messages: number;
  unanswered: number;
  first_question: string | null;
}

export async function listConversations(limit = 40): Promise<ConversationRow[]> {
  const { data: convs, error } = await db().from("sk_conversations").select("id, created_at, is_sample").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const ids = (convs ?? []).map((c) => c.id as string);
  if (ids.length === 0) return [];
  const { data: msgs } = await db().from("sk_messages").select("conversation_id, role, kind, content, created_at").in("conversation_id", ids).order("created_at");
  const by = new Map<string, { n: number; unknown: number; first: string | null }>();
  for (const m of msgs ?? []) {
    const e = by.get(m.conversation_id as string) ?? { n: 0, unknown: 0, first: null };
    e.n++;
    if (m.kind === "unknown") e.unknown++;
    if (m.role === "user" && e.first === null) e.first = m.content as string;
    by.set(m.conversation_id as string, e);
  }
  return (convs ?? []).map((c) => ({
    id: c.id as string,
    created_at: c.created_at as string,
    is_sample: c.is_sample as boolean,
    messages: by.get(c.id as string)?.n ?? 0,
    unanswered: by.get(c.id as string)?.unknown ?? 0,
    first_question: by.get(c.id as string)?.first ?? null,
  }));
}

export async function conversationMessages(id: string) {
  const { data, error } = await db().from("sk_messages").select("id, role, content, kind, mode, created_at").eq("conversation_id", id).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function listUnanswered(status: "open" | "added" | "dismissed" = "open") {
  const { data, error } = await db().from("sk_unanswered").select("id, question, status, created_at").eq("status", status).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function addAnswerFor(unansweredId: string, answer: string, category: string) {
  const { data: u, error } = await db().from("sk_unanswered").select("id, question, status").eq("id", unansweredId).single();
  if (error || !u) throw new Error("Question not found");
  if (u.status !== "open") throw new Error("Already handled");
  const { data: faq, error: e2 } = await db().from("sk_faq").insert({ question: u.question, answer, category }).select("id").single();
  if (e2) throw e2;
  await db().from("sk_unanswered").update({ status: "added", resolved_faq_id: faq.id }).eq("id", unansweredId);
  return faq.id as string;
}

export async function dismissUnanswered(id: string) {
  const { error } = await db().from("sk_unanswered").update({ status: "dismissed" }).eq("id", id).eq("status", "open");
  if (error) throw error;
}

export async function listFaqs() {
  const { data, error } = await db().from("sk_faq").select("id, category, question, answer, active").order("category").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createFaq(input: { category: string; question: string; answer: string }) {
  const { error } = await db().from("sk_faq").insert(input);
  if (error) throw error;
}

export async function deleteFaq(id: string) {
  const { error } = await db().from("sk_faq").delete().eq("id", id);
  if (error) throw error;
}
