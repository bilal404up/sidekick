"use client";

import { useRouter } from "next/navigation";

export function SignOut({ className = "btn-secondary" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
