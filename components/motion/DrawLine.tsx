"use client";

import { useInView } from "./useInView";

/* A horizontal or vertical line that draws itself once in view. Use for timelines and connectors. */
export function DrawLine({ direction = "x", className = "", ms = 900, delay = 0 }: { direction?: "x" | "y"; className?: string; ms?: number; delay?: number }) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`draw-line draw-line--${direction} ${className}`}
      data-in={inView ? "true" : undefined}
      style={{ ["--draw-ms" as string]: `${ms}ms`, ["--draw-delay" as string]: `${delay}ms` }}
    />
  );
}
