import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "./admin-auth";
import { sameOrigin } from "./http";

/** Returns an error response if the request is not an allowed admin write, otherwise null. */
export function adminWriteGuard(req: NextRequest): NextResponse | null {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  return null;
}
