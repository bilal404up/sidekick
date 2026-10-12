import { ChatPanel } from "@/components/ChatPanel";
import { AdminEntry } from "@/components/AdminEntry";
import { CatalogueWall } from "@/components/CatalogueWall";
import { IndexCard } from "@/components/IndexCard";
import { SidekickMark } from "@/components/SidekickMark";
import { llmConfigFromEnv } from "@/lib/llm";
import { isDemoMode } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function Home() {
  const llmOn = llmConfigFromEnv() !== null;
  const demo = isDemoMode();

  const steps = [
    {
      title: "It looks the question up",
      body: "Every card in the help file is checked. Rare words count for more, so \u201Crefund\u201D matters more than \u201Corder\u201D.",
    },
    {
      title: "It checks the match is close enough",
      body: "If too few of the question's words are on the best card, it stops there. It doesn't guess, and the AI model never sees the question.",
    },
    {
      title: "It answers from the card, or files the question",
      body: llmOn
        ? "An AI model rewrites the matching card in plain words. It is given only that card, and told to say so if the card doesn't answer."
        : "Right now it types out the matching card word for word. Connect any OpenAI-compatible model and it will reword the card in plain language, still using only that card.",
    },
  ];

  return (
    <>
      <header className="on-cabinet bg-cabinet text-card">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <a href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-[24px] leading-none text-card">
            <SidekickMark className="text-brass" />
            sidekick
          </a>
          <nav aria-label="Main" className="flex items-center gap-2 text-[15px] sm:gap-5">
            <a href="#install" className="hidden min-h-11 items-center text-card-dim underline-offset-4 hover:text-card hover:underline sm:inline-flex">
              Add it to a site
            </a>
            <a href="#how" className="hidden min-h-11 items-center text-card-dim underline-offset-4 hover:text-card hover:underline sm:inline-flex">
              How it decides
            </a>
            <AdminEntry demo={demo} className="btn-brass" errorClassName="text-stamp-soft" />
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-cabinet text-card">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-14 lg:pb-16">
            <div className="on-cabinet flex flex-col gap-6 lg:pt-4">
              <h1 className="max-w-[15ch] text-[44px] leading-[46px] text-card sm:text-[60px] sm:leading-[62px] xl:text-[66px] xl:leading-[66px]">
                It only answers from what&apos;s on file.
              </h1>
              <p className="max-w-[46ch] text-[18px] leading-[28px] text-card-dim">
                A help desk assistant for your shop. It looks things up in your FAQ, shows the card it used, and when a question isn&apos;t on file it says so and leaves the question in your tray.
              </p>
              <div>
                <CatalogueWall />
                <p className="mt-2 text-[13px] leading-[18px] text-card-dim">Every card in the help file has a number. Ask a question and watch its drawer.</p>
              </div>
              <ul className="space-y-2.5 text-[15px] leading-[22px] text-card">
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="legend-key font-card">Abc</span>
                  <span>Typed text is the shop&apos;s own FAQ, word for word.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="legend-key">
                    <span className="stamp stamp-mini text-stamp">No</span>
                  </span>
                  <span>A red stamp means it isn&apos;t on file. It says so instead of guessing.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="legend-key font-card">@ x</span>
                  <span>Emails and phone numbers are removed before a chat is saved.</span>
                </li>
              </ul>
              <p className="text-[14px] leading-5 text-card-dim">Fernbrook Garden Supply is an invented shop with 24 sample cards. Try the open drawer.</p>
            </div>
            <ChatPanel llmOn={llmOn} className="anim-drawer-in h-[600px] lg:h-[calc(100vh-100px)] lg:max-h-[680px] lg:min-h-[540px]" />
          </div>
        </section>

        <section id="how" className="bg-kraft">
          <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14 lg:py-20">
            <div>
              <h2 className="text-[34px] leading-[38px]">How it decides</h2>
              <p className="mt-3 text-[16px] leading-6 text-ink-muted">The same three checks, in this order, for every question. If one fails, it stops and tells the customer.</p>
            </div>
            <IndexCard tab="Card No. 0001" title="Procedure for every question">
              <ol className="grid gap-[22px] md:grid-cols-3 md:gap-0">
                {steps.map((s, i) => (
                  <li key={s.title} className={`md:px-5 ${i === 0 ? "md:pl-0" : "md:border-l md:border-stamp/40"} ${i === steps.length - 1 ? "md:pr-0" : ""}`}>
                    <h3 className="text-[19px] leading-[22px] text-ink">
                      <span className="font-card text-[15px] text-ink-muted">{i + 1}. </span>
                      {s.title}
                    </h3>
                    <p className="text-[15px] leading-[22px] text-ink-muted">{s.body}</p>
                  </li>
                ))}
              </ol>
            </IndexCard>
          </div>
        </section>

        <section id="tray" className="bg-kraft-deep">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
            <div>
              <h2 className="text-[34px] leading-[38px]">You keep the file</h2>
              <p className="mt-3 max-w-[48ch] text-[16px] leading-6 text-ink-muted">
                Every question it can&apos;t answer lands in your tray, in the customer&apos;s own words. Write the card once and it&apos;s on file for every customer after that. Delete a card and it stops answering it.
              </p>
              <div className="mt-6">
                <AdminEntry demo={demo} className="btn-primary" />
              </div>
            </div>
            <figure>
              <IndexCard
                tab="Owner's tray"
                title={"\u201Cdo you sell fertilizer\u201D"}
                titleTone="quiet"
                stamp="Not on file"
                stampTone="stamp"
                stampSize="lg"
                footer="Waiting for the owner to write this card."
              >
                <div className="h-[66px]" />
              </IndexCard>
              <figcaption className="mt-4 text-[14px] leading-5 text-ink-muted">An example from the demo tray. In the admin you write the answer on this card and file it.</figcaption>
            </figure>
          </div>
        </section>

        <section id="install" className="bg-kraft">
          <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-[34px] leading-[38px]">Add it to any site</h2>
            <p className="mt-3 max-w-[60ch] text-[16px] leading-6 text-ink-muted">
              One line before the closing body tag puts a chat button in the corner. It opens this same drawer in a frame, so your site&apos;s styles and scripts can&apos;t break it.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-md bg-cabinet p-4 font-card text-[14px] leading-[22px] text-card">
              <code>{`<script src="https://YOUR-DOMAIN/embed.js" async></script>`}</code>
            </pre>
            <p className="mt-3 text-[15px] leading-[22px]">
              <a href="/embed-demo.html" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:decoration-2">
                See it on a sample third-party page
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-cabinet">
        <div className="mx-auto max-w-[1240px] px-4 py-6 text-[13px] leading-[18px] text-card-dim sm:px-6">
          Demo project. The shop, its help file and every conversation here are sample data or visitor chats from this demo. No real customer data is involved.
        </div>
      </footer>
    </>
  );
}
