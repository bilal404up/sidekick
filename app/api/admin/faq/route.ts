import { NextResponse, type NextRequest } from "next/server";
import { adminWriteGuard } from "@/lib/admin-guard";
import { createFaq, deleteFaq } from "@/lib/store";

const UUID = /^[0-9a-f-]{36}$/;

export async function POST(req: NextRequest) {
  const blocked = adminWriteGuard(req);
  if (blocked) return blocked;
  let body: { question?: unknown; answer?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim().slice(0, 40) : "General";
  if (question.length < 3 || question.length > 300) return NextResponse.json({ error: "The question needs 3 to 300 characters." }, { status: 400 });
  if (answer.length < 3 || answer.length > 1200) return NextResponse.json({ error: "The answer needs 3 to 1200 characters." }, { status: 400 });
  await createFaq({ question, answer, category });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const blocked = adminWriteGuard(req);
  if (blocked) return blocked;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await deleteFaq(id);
  return NextResponse.json({ ok: true });
}
