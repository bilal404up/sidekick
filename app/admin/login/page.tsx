"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="mx-auto max-w-[420px] px-4 py-20">
      <h1 className="text-[28px] leading-[34px]">Owner login</h1>
      <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">Sign in to review conversations and add answers to the FAQ.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="pw" className="mb-1 block text-[14px] font-semibold">Password</label>
          <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field h-10" aria-invalid={error ? true : undefined} aria-describedby={error ? "pw-error" : undefined} />
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
      <p className="mt-6 text-[14px] leading-5 text-ink-subtle">
        <a href="/" className="underline underline-offset-4">Back to the demo</a>
      </p>
    </main>
  );
}
