import type { ReactNode } from "react";

interface IndexCardProps {
  tab?: ReactNode;
  title?: ReactNode;
  titleTone?: "display" | "quiet";
  stamp?: string;
  stampTone?: "file" | "stamp";
  stampSize?: "md" | "lg";
  footer?: ReactNode;
  children?: ReactNode;
  animate?: boolean;
  className?: string;
}

/** A ruled index card with a tab, a red header line and an optional rubber stamp. */
export function IndexCard({
  tab,
  title,
  titleTone = "display",
  stamp,
  stampTone = "file",
  stampSize = "md",
  footer,
  children,
  animate = false,
  className = "",
}: IndexCardProps) {
  const titlePad = stamp ? (stampSize === "lg" ? "pr-36" : "pr-28") : "";
  return (
    <div className={`relative max-w-full ${animate ? "anim-card-pull" : ""} ${className}`}>
      {tab && <div className="card-tab">{tab}</div>}
      <div className={`index-card ${animate ? "anim-card-settle" : ""}`}>
        {stamp && (
          <Stamp tone={stampTone} size={stampSize} animate={animate} className="absolute right-3 top-3">
            {stamp}
          </Stamp>
        )}
        <div className={`min-h-[34px] pb-2 ${titlePad}`}>
          {title ? (
            <p className={titleTone === "quiet" ? "text-[15px] leading-[22px] text-ink-muted" : "font-display text-[17px] leading-[22px] text-ink"}>
              {title}
            </p>
          ) : null}
        </div>
        <div className="card-margin" aria-hidden="true" />
        <div className="ruled-body">{children}</div>
        {footer && <p className="mt-3 border-t border-dashed border-card-edge pt-2 text-[12px] leading-4 text-ink-subtle">{footer}</p>}
      </div>
    </div>
  );
}

export function Stamp({
  tone = "file",
  size = "md",
  animate = false,
  className = "",
  children,
}: {
  tone?: "file" | "stamp";
  size?: "md" | "lg";
  animate?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={`stamp ${size === "lg" ? "stamp-lg" : ""} ${tone === "stamp" ? "text-stamp" : "text-file"} ${animate ? "anim-stamp" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
