import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { sameOrigin } from "@/lib/http";
import { respond, MAX_QUESTION_LENGTH } from "@/lib/engine/respond";
import { redact } from "@/lib/engine/redact";
import { llmConfigFromEnv } from "@/lib/llm";
import { withinLimits } from "@/lib/limits";
import { activeFaqs, conversationFor, recentCounts, saveExchange } from "@/lib/store";

const SID_COOKIE = "sk_sid";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  let message: unknown;
  try {
    message = (await req.json())?.message;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  }
  if (message.length > MAX_QUESTION_LENGTH * 2) {
    return NextResponse.json({ error: `Keep questions under ${MAX_QUESTION_LENGTH} characters.` }, { status: 400 });
  }

  const existing = req.cookies.get(SID_COOKIE)?.value;
  const sid = existing && /^[0-9a-f-]{36}$/.test(existing) ? existing : randomUUID();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const ipHash = createHash("sha256").update(`${process.env.IP_SALT ?? "sidekick"}:${forwarded}`).digest("hex").slice(0, 32);

  try {
    const counts = await recentCounts(sid, ipHash);
    if (!withinLimits(counts.session, counts.ip)) {
      return NextResponse.json({ error: "That is a lot of questions in an hour. Please try again later." }, { status: 429 });
    }

    const clean = redact(message.trim());
    const faqs = await activeFaqs();
    const reply = await respond(clean.text, faqs, { llm: llmConfigFromEnv() });
    const conversationId = await conversationFor(sid, ipHash);
    await saveExchange(conversationId, clean.text, reply);

    const res = NextResponse.json({ reply, redacted: clean.redacted });
    if (existing !== sid) {
      res.cookies.set(SID_COOKIE, sid, { httpOnly: true, sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    }
    return res;
  } catch (e) {
    console.error("chat failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Something went wrong on our side. Your question was not saved. Try again." }, { status: 500 });
  }
}
