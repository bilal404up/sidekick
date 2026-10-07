import { ChatPanel } from "@/components/ChatPanel";
import { AdminEntry } from "@/components/AdminEntry";
import { llmConfigFromEnv } from "@/lib/llm";
import { isDemoMode } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function Home() {
  const llmOn = llmConfigFromEnv() !== null;
  const demo = isDemoMode();

  return (
    <>
      <header className="border-b border-ink bg-paper-raised">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="font-display text-[22px] leading-none text-ink">sidekick</span>
          <nav aria-label="Main" className="flex items-center gap-5 text-[15px]">
            <a href="#install" className="hover:underline">Add it to a site</a>
            <a href="#how" className="hover:underline">How it decides</a>
            <AdminEntry demo={demo} className="btn-secondary" />
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1200px] gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1fr_440px] lg:pt-16">
          <div className="max-w-[640px]">
            <h1 className="text-[36px] leading-[40px] sm:text-[52px] sm:leading-[56px]">A support chatbot that only answers from your help pages.</h1>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-7 text-ink-muted">
              When a question is not in your FAQ, it says so, and saves the question for you. No made-up shipping policies, no promises you never made.
            </p>
            <ul className="mt-8 space-y-4 text-[15px] leading-[22px]">
              <li>
                <strong className="block font-semibold">Answers quote your FAQ</strong>
                <span className="text-ink-muted">Each reply shows which entry it came from.</span>
              </li>
              <li>
                <strong className="block font-semibold">Unknown questions go to a queue</strong>
                <span className="text-ink-muted">The owner adds the missing answer in one step, and the bot knows it from then on.</span>
              </li>
              <li>
                <strong className="block font-semibold">Personal details are removed</strong>
                <span className="text-ink-muted">Email addresses and phone numbers are stripped before a chat is saved.</span>
              </li>
            </ul>
            <p className="mt-8 text-[14px] leading-5 text-ink-subtle">
              Try it on the right. This is a demo for a fictional shop, Fernbrook Garden Supply, with 24 sample FAQ entries.
            </p>
          </div>
          <ChatPanel llmOn={llmOn} className="h-[580px] lg:sticky lg:top-6" />
        </section>

        <section id="how" className="border-y border-line bg-paper-raised">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
            <div>
              <h2 className="text-[22px] leading-7">1. It looks for a match</h2>
              <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">
                The question is compared with every FAQ entry. Rarer words count for more, so &ldquo;refund&rdquo; matters more than &ldquo;order&rdquo;.
              </p>
            </div>
            <div>
              <h2 className="text-[22px] leading-7">2. It checks the match is good enough</h2>
              <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">
                If too few of the question&apos;s words appear in the best entry, the bot stops. It does not guess, and it never reaches the AI model.
              </p>
            </div>
            <div>
              <h2 className="text-[22px] leading-7">3. It answers, or says it does not know</h2>
              <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">
                {llmOn
                  ? "An AI model rewrites the matching entry in plain words. It is given only that entry, and told to say so if the entry does not answer."
                  : "Right now the bot quotes the matching entry word for word. Connect any OpenAI-compatible model and it will rewrite the entry in plain words, still using only that entry."}
              </p>
            </div>
          </div>
        </section>

        <section id="install" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
          <h2 className="text-[28px] leading-[34px]">Add it to any site</h2>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-[22px] text-ink-muted">
            One line before the closing body tag adds a chat button in the corner. It opens the same assistant in a frame, so your site&apos;s styles and scripts cannot break it.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-sm border border-ink bg-ink p-4 font-mono text-[13px] leading-5 text-pine-100">
            <code>{`<script src="https://YOUR-DOMAIN/embed.js" async></script>`}</code>
          </pre>
          <p className="mt-4 text-[15px] leading-[22px]">
            <a href="/embed-demo.html" className="underline underline-offset-4 hover:decoration-2">See it on a sample third-party page</a>
          </p>
        </section>
      </main>

      <footer className="border-t border-ink bg-paper-raised">
        <div className="mx-auto max-w-[1200px] px-4 py-5 text-[13px] leading-[18px] text-ink-muted sm:px-6">
          Demo project. The shop, its FAQ and every conversation here are sample data or visitor chats from this demo. No real customer data is involved.
        </div>
      </footer>
    </>
  );
}
