import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, isDemoMode, makeAdminToken } from "@/lib/admin-auth";
import { sameOrigin } from "@/lib/http";

/**
 * Demo mode only: open the admin screens without a password, so visitors can see them.
 * Answers 404 unless DEMO_MODE is exactly "true". Only enable it where the database holds sample data.
 */
export async function POST(req: NextRequest) {
  if (!isDemoMode()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  const res = NextResponse.json({ ok: true, redirect: "/admin" });
  res.cookies.set(ADMIN_COOKIE, makeAdminToken(), adminCookieOptions());
  return res;
}
