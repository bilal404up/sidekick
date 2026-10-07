"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** In demo mode this opens the admin without a password. Otherwise it links to the login page. */
export function AdminEntry({ demo, className = "btn-primary" }: { demo: boolean; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (!demo) {
      router.push("/admin/login");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not open the admin");
      router.push(data.redirect ?? "/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the admin");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={open} disabled={busy} className={className}>
        {busy ? "Opening" : demo ? "Open the demo admin" : "Owner login"}
      </button>
      {error && (
        <span role="alert" className="text-[13px] leading-[18px] text-error">
          {error}
        </span>
      )}
    </span>
  );
}
