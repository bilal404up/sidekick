import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "sk_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) throw new Error("ADMIN_SECRET must be set (16+ characters)");
  return s;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** A signed, expiring token for the admin cookie. */
export function makeAdminToken(now = Date.now()): string {
  const exp = Math.floor(now / 1000) + MAX_AGE_SECONDS;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  try {
    return safeEqual(parts[2], sign(`${parts[0]}.${parts[1]}`));
  } catch {
    return false;
  }
}

export function adminCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_SECONDS };
}

export function passwordOk(given: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 8) return false;
  return safeEqual(given, expected);
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
