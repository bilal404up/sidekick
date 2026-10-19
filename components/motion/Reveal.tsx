"use client";

import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useInView } from "./useInView";

type Variant = "rise" | "fade" | "clip" | "scale" | "slide-left" | "slide-right";

/* Wraps content that should animate in once it scrolls into view.
   - variant: how it enters (CSS in globals.css, section 3 of the kit)
   - delay: ms before it starts
   - stagger: if set, each direct child enters this many ms after the previous one (max 8 children staggered)
   The element renders visible on the server. The hidden start state only applies once
   the html element has the "js" class AND data-in is not yet set (see kit section 4). */
export function Reveal({
  as: Tag = "div",
  variant = "rise",
  delay = 0,
  stagger,
  className = "",
  style,
  children,
  ...rest
}: {
  as?: keyof React.JSX.IntrinsicElements;
  variant?: Variant;
  delay?: number;
  stagger?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Record<string, unknown>) {
  const { ref, inView } = useInView<HTMLElement>();
  const kids = stagger
    ? Children.map(children, (child, i) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<{ style?: CSSProperties; "data-reveal-child"?: string }>, {
              "data-reveal-child": "",
              style: { ...(child.props as { style?: CSSProperties }).style, ["--i" as string]: Math.min(i, 8) },
            })
          : child,
      )
    : children;
  const Any = Tag as unknown as React.ElementType;
  return (
    <Any
      ref={ref}
      data-reveal={variant}
      data-in={inView ? "true" : undefined}
      className={className}
      style={{ ...style, ["--reveal-delay" as string]: `${delay}ms`, ["--reveal-stagger" as string]: `${stagger ?? 0}ms` }}
      {...rest}
    >
      {kids}
    </Any>
  );
}
