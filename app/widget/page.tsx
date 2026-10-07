import { ChatPanel } from "@/components/ChatPanel";
import { llmConfigFromEnv } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sidekick chat" };

/** The page the embed script frames. It is the whole chat window and nothing else. */
export default function WidgetPage() {
  return (
    <div className="h-screen p-0">
      <ChatPanel llmOn={llmConfigFromEnv() !== null} className="h-full rounded-none border-0" />
    </div>
  );
}
