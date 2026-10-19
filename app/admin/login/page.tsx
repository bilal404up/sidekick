"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/Wordmark";

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
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="anim-rise w-full max-w-[420px]">
        <a href="/" className="inline-flex min-h-11 items-center" aria-label="Sidekick home">
          <Mark size={44} />
        </a>
        <p className="label mt-8 text-ink-2">Owner view</p>
        <h1 className="display mt-3 text-[44px] leading-[46px]">Owner login</h1>
        <p className="mt-3 text-[16px] leading-[26px] text-ink-2">Sign in to read conversations and add answers to the FAQ.</p>
        <form onSubmit={submit} className="mt-8 space-y-4 border-t border-ink pt-6">
          <div>
            <label htmlFor="pw" className="mb-1.5 block text-[14px] font-medium leading-5">
              Password
            </label>
            <input
              id="pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field h-12"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "pw-error" : undefined}
            />
            {error && (
              <p id="pw-error" role="alert" className="mt-1.5 text-[13px] leading-[18px] text-error">
                {error}
              </p>
            )}
          </div>
          <button type="submit" disabled={busy || password.length === 0} className="btn-primary h-12 w-full">
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-[14px] leading-5">
          <a href="/" className="inline-flex min-h-11 items-center gap-2 text-ink-2 underline underline-offset-4 hover:text-ink">
            <span aria-hidden="true">&larr;</span>
            Back to the demo
          </a>
        </p>
      </div>
    </main>
  );
}
