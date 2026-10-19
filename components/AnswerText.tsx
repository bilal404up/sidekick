import { Fragment, type CSSProperties, type ReactNode } from "react";
import { tokens } from "@/lib/engine/text";

type Block = { type: "p"; text: string } | { type: "ol"; start: number; items: string[] } | { type: "ul"; items: string[] };

const OL = /^\s*(\d+)[.)]\s+(.*)$/;
const UL = /^\s*[-*\u2022]\s+(.*)$/;

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ol = OL.exec(line);
    const ul = UL.exec(line);
    const last = blocks[blocks.length - 1];
    if (ol) {
      if (last?.type === "ol") last.items.push(ol[2]);
      else blocks.push({ type: "ol", start: Number(ol[1]), items: [ol[2]] });
    } else if (ul) {
      if (last?.type === "ul") last.items.push(ul[1]);
      else blocks.push({ type: "ul", items: [ul[1]] });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }
  return blocks;
}

function marked(text: string, stems?: Set<string>, seq?: { n: number }): ReactNode {
  if (!stems || stems.size === 0) return text;
  return text.split(/(\s+)/).map((part, i) => {
    const t = part.trim() ? tokens(part)[0] : undefined;
    return t && stems.has(t) ? (
      // --i staggers the highlighter sweep, 40ms per matched word.
      <mark key={i} className="mark" style={{ "--i": seq ? seq.n++ : 0 } as CSSProperties}>
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}

/** FAQ text laid out as paragraphs and lists. The words are never changed; matched words can be highlighted. */
export function AnswerText({ text, stems, className = "" }: { text: string; stems?: Set<string>; className?: string }) {
  const seq = { n: 0 };
  return (
    <div className={`space-y-2 ${className}`}>
      {toBlocks(text).map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{marked(b.text, stems, seq)}</p>
        ) : b.type === "ol" ? (
          <ol key={i} start={b.start} className="list-decimal space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>{marked(it, stems, seq)}</li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>{marked(it, stems, seq)}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
