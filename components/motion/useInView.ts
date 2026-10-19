"use client";

import { useEffect, useRef, useState } from "react";

/* True once the element has entered the viewport. Fires once, then stops observing.
   Under reduced motion, or without IntersectionObserver, it is true at once. */
export function useInView<T extends Element>(opts: { rootMargin?: string; threshold?: number } = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    (window as Window & { __kit?: boolean }).__kit = true;
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: opts.rootMargin ?? "0px 0px -10% 0px", threshold: opts.threshold ?? 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [opts.rootMargin, opts.threshold]);

  return { ref, inView };
}
