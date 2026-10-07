import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { conversationMessages } from "@/lib/store";

const UUID = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    return NextResponse.json({ messages: await conversationMessages(id) });
  } catch {
    return NextResponse.json({ error: "Could not load the conversation" }, { status: 500 });
  }
}
