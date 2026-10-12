"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FILE_EVENT, type FileEventDetail } from "@/lib/cardCode";

const NUMBERED = Array.from({ length: 10 }, (_, i) => ({ key: String(i), top: `No. ${i}000`, bottom: `to ${i}999` }));

/**
 * The wall of catalogue drawers on the hero. Decorative: the chat log already announces everything.
 * When the chat pulls card No. 3318, drawer 3000 to 3999 lifts. When a question is not on file, the tray gets a slip.
 */
export function CatalogueWall() {
  const [pulled, setPulled] = useState<string | null>(null);
  const [tray, setTray] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFile = (e: Event) => {
      const d = (e as CustomEvent<FileEventDetail>).detail;
      if (!d) return;
      const key = d.kind === "unknown" ? "tray" : d.code.charAt(0);
      if (d.kind === "unknown") setTray((n) => n + 1);
      setPulled(key);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPulled(null), 1600);
    };
    window.addEventListener(FILE_EVENT, onFile);
    return () => {
      window.removeEventListener(FILE_EVENT, onFile);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-hidden="true" className="anim-wall grid grid-cols-4 gap-2 sm:grid-cols-6">
      {NUMBERED.map((d, i) => (
        <Drawer key={d.key} index={i} top={d.top} bottom={d.bottom} pulled={pulled === d.key} />
      ))}
      <Drawer index={10} top="Tray" bottom={tray > 0 ? `${tray} new` : "empty"} pulled={pulled === "tray"} slip={tray} />
      <Drawer index={11} top="Blank" bottom="cards" pulled={false} />
    </div>
  );
}

function Drawer({ index, top, bottom, pulled, slip = 0 }: { index: number; top: string; bottom: string; pulled: boolean; slip?: number }) {
  return (
    <div className={`drawer ${pulled ? "is-pulled" : ""}`} style={{ "--i": index } as CSSProperties}>
      {slip > 0 && <span key={slip} className="drawer-slip anim-slip-pop" />}
      <span className="drawer-label">
        <span className="block">{top}</span>
        <span className="block">{bottom}</span>
      </span>
      <span className="drawer-pull" />
    </div>
  );
}
