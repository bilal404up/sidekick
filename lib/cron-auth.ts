import { timingSafeEqual } from "node:crypto";

/**
 * True only when CRON_SECRET is set to a real value and the Authorization
 * header carries exactly that value. An unset or empty secret never matches,
 * so a missing env var cannot turn into "Bearer undefined" being accepted.
 */
export function isCronAuthorized(header: string | null, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret || secret === "undefined") return false;
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
