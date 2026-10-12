"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidekickMark } from "@/components/SidekickMark";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not sign in");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-cabinet px-4 py-14 sm:py-24">
      <div className="mx-auto max-w-[440px]">
        <p className="on-cabinet mb-8">
          <a href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-[24px] leading-none text-card">
            <SidekickMark className="text-brass" />
            sidekick
          </a>
        </p>

        <div className="anim-card-pull">
          <div className="card-tab">Staff only</div>
          <div className="index-card">
            <div className="min-h-[34px] pb-2">
              <h1 className="text-[26px] leading-[30px] text-ink">Owner login</h1>
            </div>
            <div className="card-margin" aria-hidden="true" />
            <div className="ruled-body">
              <p className="text-[15px] leading-[22px] text-ink-muted">Sign in to read conversations and write answers for the FAQ.</p>
              <form onSubmit={submit} className="mt-[22px] space-y-4">
                <div>
                  <label htmlFor="pw" className="mb-1 block text-[14px] font-bold leading-[22px] text-ink">
                    Password
                  </label>
                  <input
                    id="pw"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field h-11"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "pw-error" : undefined}
                  />
                  {error && (
                    <p id="pw-error" role="alert" className="mt-1 text-[13px] leading-[18px] text-error">
                      {error}
                    </p>
                  )}
                </div>
                <button type="submit" disabled={busy || password.length === 0} className="btn-primary w-full">
                  {busy ? "Signing in" : "Sign in"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <p className="on-cabinet mt-6 text-[14px] leading-5">
          <a href="/" className="inline-flex min-h-11 items-center text-card-dim underline underline-offset-4 hover:text-card">
            Back to the demo
          </a>
        </p>
      </div>
    </main>
  );
}
