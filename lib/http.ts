import type { NextRequest } from "next/server";

/** Browsers send Origin on POST. A missing or different Origin is refused (cross-site request protection). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
