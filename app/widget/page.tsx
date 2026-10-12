import { ChatPanel } from "@/components/ChatPanel";
import { WidgetBridge } from "@/components/WidgetBridge";
import { llmConfigFromEnv } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sidekick chat" };

/** The page the embed script frames. It is the whole chat window and nothing else. */
export default function WidgetPage() {
  return (
    <div className="h-screen bg-surface">
      <h1 className="sr-only">Sidekick chat</h1>
      <WidgetBridge />
      <ChatPanel llmOn={llmConfigFromEnv() !== null} variant="widget" className="h-full" />
    </div>
  );
}
