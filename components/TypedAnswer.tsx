type Block = { type: "p"; text: string } | { type: "ol"; start: number; items: string[] } | { type: "ul"; items: string[] };

const OL = /^\s*(\d+)[.)]\s+(.*)$/;
const UL = /^\s*[-*\u2022]\s+(.*)$/;

/** Splits an answer into paragraphs and lists. It only lays the text out; it never changes the words. */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ol = OL.exec(line);
    const ul = UL.exec(line);
    const last = blocks[blocks.length - 1];
    if (ol) {
      if (last && last.type === "ol") last.items.push(ol[2]);
      else blocks.push({ type: "ol", start: Number(ol[1]), items: [ol[2]] });
    } else if (ul) {
      if (last && last.type === "ul") last.items.push(ul[1]);
      else blocks.push({ type: "ul", items: [ul[1]] });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }
  return blocks;
}

/** The shop's own words, typed on the card. */
export function TypedAnswer({ text, className = "" }: { text: string; className?: string }) {
  const blocks = toBlocks(text);
  return (
    <div className={`font-card text-[15px] leading-[22px] text-ink ${className}`}>
      {blocks.map((b, i) => {
        const gap = i > 0 ? "mt-[22px]" : "";
        if (b.type === "p") return <p key={i} className={gap}>{b.text}</p>;
        if (b.type === "ol")
          return (
            <ol key={i} start={b.start} className={`list-decimal pl-6 ${gap}`}>
              {b.items.map((it, j) => <li key={j}>{it}</li>)}
            </ol>
          );
        return (
          <ul key={i} className={`list-disc pl-6 ${gap}`}>
            {b.items.map((it, j) => <li key={j}>{it}</li>)}
          </ul>
        );
      })}
    </div>
  );
}
