import { ChatPanel } from "@/components/ChatPanel";
import { WidgetBridge } from "@/components/WidgetBridge";
import { llmConfigFromEnv } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sidekick chat" };

/** The page the embed script frames. It is the whole open drawer and nothing else. */
export default function WidgetPage() {
  return (
    <div className="h-screen bg-kraft p-0">
      <h1 className="sr-only">Sidekick chat</h1>
      <WidgetBridge />
      <ChatPanel llmOn={llmConfigFromEnv() !== null} variant="widget" className="h-full rounded-none border-0 shadow-none" />
    </div>
  );
}
