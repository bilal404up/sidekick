"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** In demo mode this opens the owner view without a password. Otherwise it links to the login page. */
export function AdminEntry({
  demo,
  className = "btn-primary",
  errorClassName = "text-error",
  label,
}: {
  demo: boolean;
  className?: string;
  errorClassName?: string;
  /** Shorter button text where space is tight. */
  label?: string;
}) {
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
      if (!res.ok) throw new Error(data.error ?? "Could not open the owner view");
      router.push(data.redirect ?? "/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the owner view");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={open} disabled={busy} className={className}>
        {busy ? "Opening" : label ?? (demo ? "Open the owner view" : "Owner login")}
      </button>
      {error && (
        <span role="alert" className={`text-[13px] leading-[18px] ${errorClassName}`}>
          {error}
        </span>
      )}
    </span>
  );
}
