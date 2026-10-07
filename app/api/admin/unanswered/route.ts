import { NextResponse, type NextRequest } from "next/server";
import { adminWriteGuard } from "@/lib/admin-guard";
import { addAnswerFor, dismissUnanswered } from "@/lib/store";

const UUID = /^[0-9a-f-]{36}$/;

export async function POST(req: NextRequest) {
  const blocked = adminWriteGuard(req);
  if (blocked) return blocked;

  let body: { id?: unknown; action?: unknown; answer?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !UUID.test(body.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    if (body.action === "dismiss") {
      await dismissUnanswered(body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "add") {
      const answer = typeof body.answer === "string" ? body.answer.trim() : "";
      const category = typeof body.category === "string" && body.category.trim() ? body.category.trim().slice(0, 40) : "General";
      if (answer.length < 3 || answer.length > 1200) return NextResponse.json({ error: "Write an answer between 3 and 1200 characters." }, { status: 400 });
      await addAnswerFor(body.id, answer, category);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
