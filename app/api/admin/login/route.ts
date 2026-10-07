import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, makeAdminToken, passwordOk } from "@/lib/admin-auth";
import { sameOrigin } from "@/lib/http";

/** Slows down repeated wrong guesses from one address. In-memory, so it is best-effort on serverless. */
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && now - rec.first < WINDOW_MS && rec.n >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });
  }

  let password: unknown;
  try {
    password = (await req.json())?.password;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof password !== "string" || !passwordOk(password)) {
    const fresh = rec && now - rec.first < WINDOW_MS ? rec : { n: 0, first: now };
    attempts.set(ip, { n: fresh.n + 1, first: fresh.first });
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeAdminToken(), adminCookieOptions());
  return res;
}
