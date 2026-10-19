import { ChatPanel } from "@/components/ChatPanel";
import { WidgetBridge } from "@/components/WidgetBridge";
import { llmConfigFromEnv } from "@/lib/llm";
import { listFaqs } from "@/lib/store";
import { aliasMap } from "@/lib/faqGroups";
import { citeMap, type Cite } from "@/lib/cite";
import type { Faq } from "@/lib/engine/retrieve";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata = { title: "Sidekick chat" };

/** Citation numbers match the home page index. If the FAQ can't be read, answers fall back to showing the entry's question. */
async function loadCites(): Promise<Record<string, Cite> | undefined> {
  try {
    const all = (await listFaqs()) as Faq[];
    return citeMap(all, aliasMap(all));
  } catch {
    return undefined;
  }
}

/** The page the embed script frames. It is the whole chat window and nothing else. */
export default async function WidgetPage() {
  const cites = await loadCites();
  return (
    <div className="h-screen bg-sheet">
      <h1 className="sr-only">Sidekick chat</h1>
      <WidgetBridge />
      <ChatPanel llmOn={llmConfigFromEnv() !== null} variant="widget" cites={cites} className="h-full" />
    </div>
  );
}
