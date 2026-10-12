import { HeroDemo, type FaqLite } from "@/components/HeroDemo";
import type { ScriptStep } from "@/components/ChatPanel";
import { AdminEntry } from "@/components/AdminEntry";
import { Wordmark } from "@/components/Wordmark";
import { llmConfigFromEnv } from "@/lib/llm";
import { isDemoMode } from "@/lib/admin-auth";
import { listFaqs } from "@/lib/store";
import { respond } from "@/lib/engine/respond";
import { MIN_COVERAGE, type Faq } from "@/lib/engine/retrieve";

export const dynamic = "force-dynamic";

const EXAMPLES = ["How much is shipping?", "Can you recommend a laptop?"];

/** Loads the FAQ and runs the two example questions through the real engine. respond() only reads; nothing is stored. */
async function loadDemo(): Promise<{ faqs: FaqLite[]; script?: ScriptStep[] }> {
  try {
    const all = (await listFaqs()) as Faq[];
    const faqs = all.map((f) => ({ id: f.id, category: f.category ?? "General", question: f.question }));
    if (all.length === 0) return { faqs };
    const script = await Promise.all(EXAMPLES.map(async (question) => ({ question, reply: await respond(question, all) })));
    return { faqs, script };
  } catch {
    return { faqs: [] };
  }
}

export default async function Home() {
  const llmOn = llmConfigFromEnv() !== null;
  const demo = isDemoMode();
  const { faqs, script } = await loadDemo();
  const pct = Math.round(MIN_COVERAGE * 100);

  const steps = [
    {
      title: "It looks for the closest FAQ entry",
      body: "Every entry is compared with the question. Rare words count for more, so \u201Crefund\u201D matters more than \u201Corder\u201D.",
    },
    {
      title: "It checks the match is strong enough",
      body: `The best entry has to cover at least ${pct}% of the question's key words, weighted by how rare they are. If it doesn't, Sidekick stops there. It doesn't guess, and the AI model never sees the question.`,
    },
    {
      title: "It answers from that entry, or hands the question to you",
      body: llmOn
        ? "An AI model rewrites the matching entry in plain words. It is given only that entry, and told to say so if the entry doesn't answer the question."
        : "Right now it quotes the matching entry word for word. Connect any OpenAI-compatible model and it will reword the entry in plain language, still using only that entry.",
    },
  ];

  const flow = [
    { title: "A customer asks something new", body: "The FAQ doesn't cover it, so Sidekick says so instead of guessing.", dot: "bg-asked" },
    { title: "It lands in your inbox", body: "In the customer's own words, with emails and phone numbers removed.", dot: "bg-ink" },
    { title: "You answer it once", body: "From then on, every customer who asks gets your answer.", dot: "bg-found" },
  ];

  return (
    <>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <a href="/" className="inline-flex min-h-11 items-center">
            <Wordmark />
          </a>
          <nav aria-label="Main" className="flex items-center gap-1 text-[14px] sm:gap-2">
            <a href="#how" className="hidden min-h-11 items-center rounded-md px-3 text-ink-muted hover:text-ink sm:inline-flex">
              How it decides
            </a>
            <a href="#install" className="hidden min-h-11 items-center rounded-md px-3 text-ink-muted hover:text-ink sm:inline-flex">
              Add it to a site
            </a>
            <AdminEntry demo={demo} className="btn-primary" />
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:pb-20 lg:pt-8">
          <div className="anim-hero">
            <div style={{ "--i": 0 } as React.CSSProperties} className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <h1 className="max-w-[20ch] text-[40px] leading-[42px] sm:text-[54px] sm:leading-[56px]">It answers from your FAQ, or it asks you.</h1>
              <p className="max-w-[46ch] text-[16px] leading-6 text-ink-muted lg:pb-1.5">
                A support assistant for small shops. Every answer links to the FAQ entry it came from. Anything the FAQ doesn&apos;t cover goes to the owner instead of being made up.
              </p>
            </div>
            <div style={{ "--i": 1 } as React.CSSProperties} className="mt-6">
              <HeroDemo llmOn={llmOn} demo={demo} faqs={faqs} script={script} />
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-[18px] text-ink-subtle">
            Fernbrook Garden Supply is an invented shop with sample data. Tap Check it under any answer to see the entry it came from.
          </p>
        </section>

        <section id="how" className="border-y border-rule bg-surface">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:py-24">
            <div>
              <h2 className="max-w-[18ch] text-[32px] leading-[36px] sm:text-[40px] sm:leading-[44px]">A chatbot invented a refund policy. The airline had to pay.</h2>
              <p className="mt-5 max-w-[52ch] text-[16px] leading-[26px] text-ink-muted">
                In 2024, Air Canada&apos;s website chatbot told a grieving customer he could claim a bereavement discount after booking. The real policy said no. A British Columbia tribunal ruled that the
                airline is responsible for everything on its website, chatbot included, and ordered it to refund part of the fare.
              </p>
              <p className="mt-3 text-[13px] leading-5 text-ink-subtle">Moffatt v. Air Canada, 2024 BCCRT 149.</p>
            </div>
            <div>
              <h3 className="text-[20px] leading-7">Sidekick is built so it can&apos;t do that</h3>
              <ol className="mt-6 space-y-6">
                {steps.map((s, i) => (
                  <li key={s.title} className="grid grid-cols-[32px_1fr] gap-4">
                    <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-rule text-[14px] font-semibold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[16px] font-semibold leading-6">{s.title}</p>
                      <p className="mt-1 text-[15px] leading-[23px] text-ink-muted">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="owner" className="mx-auto grid max-w-[1280px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-20 lg:py-24">
          <div>
            <h2 className="text-[32px] leading-[36px] sm:text-[40px] sm:leading-[44px]">You stay in charge of every answer</h2>
            <p className="mt-5 max-w-[48ch] text-[16px] leading-[26px] text-ink-muted">
              Questions the FAQ can&apos;t answer wait in your inbox, in the customer&apos;s own words. Write the answer once and it&apos;s live for every customer after that. Delete an entry and Sidekick
              stops using it.
            </p>
            <div className="mt-6">
              <AdminEntry demo={demo} className="btn-primary" />
            </div>
          </div>
          <ol className="panel grid divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {flow.map((f) => (
              <li key={f.title} className="p-5">
                <span aria-hidden="true" className={`dot ${f.dot}`} />
                <p className="mt-3 text-[15px] font-semibold leading-[22px]">{f.title}</p>
                <p className="mt-1 text-[14px] leading-[21px] text-ink-muted">{f.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="install" className="border-y border-rule bg-surface">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-24">
            <div>
              <h2 className="text-[32px] leading-[36px] sm:text-[40px] sm:leading-[44px]">Add it to any site with one line</h2>
              <p className="mt-5 max-w-[52ch] text-[16px] leading-[26px] text-ink-muted">
                Paste this before the closing body tag. It adds a chat button in the corner and opens the assistant in a frame, so your site&apos;s styles and scripts can&apos;t break it.
              </p>
              <p className="mt-4">
                <a href="/embed-demo.html" className="inline-flex min-h-11 items-center text-[15px] font-semibold underline underline-offset-4 hover:decoration-2">
                  See it on a sample third-party page
                </a>
              </p>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-ink p-5 font-mono text-[14px] leading-6 text-[#E7F3EC]">
              <code>{`<script src="https://YOUR-DOMAIN/embed.js" async></script>`}</code>
            </pre>
          </div>
        </section>

        <section aria-labelledby="build" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:py-24">
          <h2 id="build" className="text-[32px] leading-[36px] sm:text-[40px] sm:leading-[44px]">
            About this build
          </h2>
          <dl className="mt-8 grid gap-8 md:grid-cols-3">
            <div>
              <dt className="text-[15px] font-semibold leading-[22px]">The problem</dt>
              <dd className="mt-2 text-[15px] leading-[23px] text-ink-muted">
                Small shops want to answer customers around the clock, but a bot that invents a policy can cost them money and trust.
              </dd>
            </div>
            <div>
              <dt className="text-[15px] font-semibold leading-[22px]">The approach</dt>
              <dd className="mt-2 text-[15px] leading-[23px] text-ink-muted">
                Keyword retrieval with a {pct}% match bar, answers quoted straight from the FAQ, unanswered questions routed to the owner, and an optional AI step that only ever sees one entry.
              </dd>
            </div>
            <div>
              <dt className="text-[15px] font-semibold leading-[22px]">The outcome</dt>
              <dd className="mt-2 text-[15px] leading-[23px] text-ink-muted">
                A widget that installs with one line and answers only from the FAQ. Emails and phone numbers are removed before a chat is stored, and automated tests cover matching and refusals.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[1280px] px-4 py-6 text-[13px] leading-[18px] text-ink-muted sm:px-6">
          Demo project. The shop, its FAQ and every conversation here are sample data or visitor chats from this demo. No real customer data is involved.
        </div>
      </footer>
    </>
  );
}
