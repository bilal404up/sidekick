import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE, makeAdminToken, verifyAdminToken, passwordOk, safeEqual } from "../lib/admin-auth";
import { withinLimits, MAX_USER_MESSAGES_PER_SESSION_HOUR } from "../lib/limits";

beforeEach(() => {
  process.env.ADMIN_SECRET = "test-secret-with-enough-length";
  process.env.ADMIN_PASSWORD = "correct-horse-battery";
  delete process.env.DEMO_MODE;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy";
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// ---- admin token ----
test("admin token verifies, expires, and rejects tampering", () => {
  const t = makeAdminToken(1_000_000);
  assert.equal(verifyAdminToken(t, 1_000_000 + 1000), true);
  assert.equal(verifyAdminToken(t, 1_000_000 + 9 * 60 * 60 * 1000), false, "expired after 8 hours");
  const [a, b, c] = t.split(".");
  assert.equal(verifyAdminToken(`${a}.${Number(b) + 99999}.${c}`), false, "changed expiry");
  assert.equal(verifyAdminToken(`${a}.${b}.${c.slice(0, -2)}xx`), false, "changed signature");
  assert.equal(verifyAdminToken("admin.9999999999.abc"), false);
  assert.equal(verifyAdminToken(undefined), false);
  assert.equal(verifyAdminToken(""), false);
});

test("a token signed with another secret is rejected", () => {
  const t = makeAdminToken();
  process.env.ADMIN_SECRET = "a-different-secret-entirely";
  assert.equal(verifyAdminToken(t), false);
});

test("the admin password check is exact and needs a real password configured", () => {
  assert.equal(passwordOk("correct-horse-battery"), true);
  assert.equal(passwordOk("correct-horse-batter"), false);
  assert.equal(passwordOk(""), false);
  process.env.ADMIN_PASSWORD = "short";
  assert.equal(passwordOk("short"), false, "too short to be accepted");
  delete process.env.ADMIN_PASSWORD;
  assert.equal(passwordOk("anything"), false);
  assert.equal(safeEqual("a", "ab"), false);
});

// ---- limits ----
test("message limits trip at the configured numbers", () => {
  assert.equal(withinLimits(0, 0), true);
  assert.equal(withinLimits(MAX_USER_MESSAGES_PER_SESSION_HOUR - 1, 0), true);
  assert.equal(withinLimits(MAX_USER_MESSAGES_PER_SESSION_HOUR, 0), false);
  assert.equal(withinLimits(0, 60), false);
});

// ---- routes ----
test("chat refuses cross-site requests and bad bodies before touching the database", async () => {
  const { POST } = await import("../app/api/chat/route");
  assert.equal((await POST(post("/api/chat", { message: "hi" }, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await POST(post("/api/chat", { message: "hi" }, { origin: "" }))).status, 403);
  assert.equal((await POST(post("/api/chat", "not json"))).status, 400);
  assert.equal((await POST(post("/api/chat", { message: "   " }))).status, 400);
  assert.equal((await POST(post("/api/chat", { message: 42 }))).status, 400);
  assert.equal((await POST(post("/api/chat", { message: "x".repeat(1200) }))).status, 400);
});

test("admin login: wrong password is 401, cross-site is 403, right password sets a signed cookie", async () => {
  const { POST } = await import("../app/api/admin/login/route");
  assert.equal((await POST(post("/api/admin/login", { password: "nope" }, { "x-forwarded-for": "1.1.1.1" }))).status, 401);
  assert.equal((await POST(post("/api/admin/login", { password: "correct-horse-battery" }, { origin: "https://evil.example" }))).status, 403);
  const ok = await POST(post("/api/admin/login", { password: "correct-horse-battery" }, { "x-forwarded-for": "2.2.2.2" }));
  assert.equal(ok.status, 200);
  const cookie = ok.cookies.get(ADMIN_COOKIE);
  assert.ok(cookie && verifyAdminToken(cookie.value));
});

test("admin login slows down repeated wrong guesses", async () => {
  const { POST } = await import("../app/api/admin/login/route");
  const h = { "x-forwarded-for": "9.9.9.9" };
  for (let i = 0; i < 5; i++) assert.equal((await POST(post("/api/admin/login", { password: "bad" + i }, h))).status, 401);
  assert.equal((await POST(post("/api/admin/login", { password: "correct-horse-battery" }, h))).status, 429, "even the right password waits");
});

test("admin writes need a valid cookie and a same-site origin", async () => {
  const unans = await import("../app/api/admin/unanswered/route");
  const faq = await import("../app/api/admin/faq/route");
  const body = { id: "00000000-0000-0000-0000-000000000000", action: "dismiss" };
  assert.equal((await unans.POST(post("/api/admin/unanswered", body))).status, 401, "no cookie");
  assert.equal((await unans.POST(post("/api/admin/unanswered", body, { cookie: `${ADMIN_COOKIE}=forged.1.abc` }))).status, 401, "forged cookie");
  const good = `${ADMIN_COOKIE}=${makeAdminToken()}`;
  assert.equal((await unans.POST(post("/api/admin/unanswered", body, { cookie: good, origin: "https://evil.example" }))).status, 403, "cross-site with a real cookie");
  assert.equal((await unans.POST(post("/api/admin/unanswered", { id: "x", action: "dismiss" }, { cookie: good }))).status, 400, "bad id");
  assert.equal((await faq.POST(post("/api/admin/faq", { question: "ok?", answer: "yes" }))).status, 401);
  const del = new NextRequest("http://localhost/api/admin/faq?id=00000000-0000-0000-0000-000000000000", { method: "DELETE", headers: { host: "localhost", origin: "http://localhost" } });
  assert.equal((await faq.DELETE(del)).status, 401);
});

test("demo admin route is 404 unless DEMO_MODE is exactly true, and refuses cross-site", async () => {
  const { POST } = await import("../app/api/demo/admin/route");
  assert.equal((await POST(post("/api/demo/admin", {}))).status, 404);
  process.env.DEMO_MODE = "yes";
  assert.equal((await POST(post("/api/demo/admin", {}))).status, 404);
  process.env.DEMO_MODE = "true";
  assert.equal((await POST(post("/api/demo/admin", {}, { origin: "https://evil.example" }))).status, 403);
  const ok = await POST(post("/api/demo/admin", {}));
  assert.equal(ok.status, 200);
  assert.ok(verifyAdminToken(ok.cookies.get(ADMIN_COOKIE)?.value));
});

// ---- cron ----
test("maintenance cron refuses when the secret is unset, empty, or guessed", async () => {
  const { GET } = await import("../app/api/cron/maintain/route");
  const call = (auth?: string) =>
    GET(new NextRequest("http://localhost/api/cron/maintain", { headers: auth ? { authorization: auth } : {} }));
  delete process.env.CRON_SECRET;
  assert.equal((await call()).status, 401);
  assert.equal((await call("Bearer undefined")).status, 401, "the string undefined is not a secret");
  process.env.CRON_SECRET = "a-real-cron-secret-value";
  assert.equal((await call("Bearer wrong")).status, 401);
  assert.equal((await call()).status, 401);
  process.env.CRON_SECRET = "";
  assert.equal((await call("Bearer ")).status, 401);
});
