import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { db } from "@/lib/supabase";

const RETENTION_DAYS = 7;

/**
 * Daily housekeeping, called by Vercel Cron.
 * 1. Deletes visitor conversations older than 7 days (sample conversations are kept).
 * 2. Touches the database, which also stops a free Supabase project from pausing for inactivity.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
    const { data, error } = await db().from("sk_conversations").delete().eq("is_sample", false).lt("created_at", cutoff).select("id");
    if (error) throw error;
    const { count } = await db().from("sk_faq").select("id", { count: "exact", head: true });
    return NextResponse.json({ deletedConversations: data?.length ?? 0, faqEntries: count ?? 0 });
  } catch (e) {
    console.error("maintain failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
