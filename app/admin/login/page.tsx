"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";

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
      <div className="w-full max-w-[400px]">
        <a href="/" className="inline-flex min-h-11 items-center">
          <Wordmark />
        </a>
        <div className="panel anim-rise mt-6 p-6">
          <h1 className="text-[24px] leading-[30px]">Owner login</h1>
          <p className="mt-1.5 text-[15px] leading-[22px] text-ink-muted">Sign in to read conversations and add answers to the FAQ.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="pw" className="mb-1.5 block text-[14px] font-semibold leading-5">
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
                <p id="pw-error" role="alert" className="mt-1.5 text-[13px] leading-[18px] text-error">
                  {error}
                </p>
              )}
            </div>
            <button type="submit" disabled={busy || password.length === 0} className="btn-primary w-full">
              {busy ? "Signing in" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-[14px] leading-5">
          <a href="/" className="inline-flex min-h-11 items-center text-ink-muted underline underline-offset-4 hover:text-ink">
            Back to the demo
          </a>
        </p>
      </div>
    </main>
  );
}
