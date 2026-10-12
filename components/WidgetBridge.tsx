"use client";

import { useEffect } from "react";

/** Inside the embed frame, Escape asks the host page to close the chat. On its own page it does nothing. */
export function WidgetBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.parent.postMessage("sidekick:close", "*");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
