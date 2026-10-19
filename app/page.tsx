import { HeroDemo, type FaqLite } from "@/components/HeroDemo";
import { MatchScale, type ScriptStep } from "@/components/ChatPanel";
import { AdminEntry } from "@/components/AdminEntry";
import { Wordmark } from "@/components/Wordmark";
import { llmConfigFromEnv } from "@/lib/llm";
import { isDemoMode } from "@/lib/admin-auth";
import { listFaqs } from "@/lib/store";
import { aliasMap } from "@/lib/faqGroups";
import { citeLabel, citeMap } from "@/lib/cite";
import { respond, UNKNOWN_TEXT } from "@/lib/engine/respond";
import { MIN_COVERAGE, type Faq } from "@/lib/engine/retrieve";

export const dynamic = "force-dynamic";
// The FAQ list must come from the database on every visit, not from Vercel's shared data cache.
export const fetchCache = "force-no-store";

// The unanswered example plays first, so the run ends on the cited answer with its thread drawn.
const EXAMPLES = ["Can you recommend a laptop?", "How much is shipping?"];
const NEW_QUESTION = "Can you recommend a laptop?";
const NEW_ANSWER = "We only sell garden supplies, so we can't recommend a laptop.";

/** Loads the FAQ and runs the two example questions through the real engine. respond() only reads; nothing is stored. */
async function loadDemo(): Promise<{ faqs: FaqLite[]; script?: ScriptStep[] }> {
  try {
    const all = (await listFaqs()) as Faq[];
    const aliases = aliasMap(all);
    const faqs = all.map((f) => ({ id: f.id, category: f.category ?? "General", question: f.question, aliasOf: aliases.get(f.id) }));
    if (all.length === 0) return { faqs };
    const script = await Promise.all(EXAMPLES.map(async (question) => ({ question, reply: await respond(question, all) })));
    return { faqs, script };
  } catch {
    return { faqs: [] };
  }
}

const h2 = "display text-[40px] leading-[44px] sm:text-[56px] sm:leading-[58px]";

export default async function Home() {
  const llmOn = llmConfigFromEnv() !== null;
  const demo = isDemoMode();
  const { faqs, script } = await loadDemo();
  const pct = Math.round(MIN_COVERAGE * 100);
  const cites = citeMap(faqs);

  // Real engine output for the sourced example, reused to illustrate the three checks.
  const sample = script?.find((s) => s.reply.kind === "answer");
  const sampleSource = sample?.reply.sources[0];
  const sampleCite = sampleSource ? cites[sampleSource.id] : undefined;
  const sampleStrength = sample?.reply.match ? Math.round(sample.reply.match.strength * 100) : null;

  const steps = [
    {
      title: "Find the closest FAQ entry",
      body: "Every entry is compared with the question. Rare words count for more, so “refund” matters more than “order”.",
    },
    {
      title: "Is the match strong enough?",
      body: `The best entry has to cover at least ${pct}% of the question's key words, weighted by how rare they are. If it doesn't, Sidekick stops there. It doesn't guess, and the language model never sees the question.`,
    },
    {
      title: "Quote it, or hand it to you",
      body: llmOn
        ? "A language model rewrites the matching entry in plain words. It is given only that entry, and told to say so if the entry doesn't answer the question."
        : "Right now it quotes the matching entry word for word. Connect any OpenAI-compatible model and it will reword the entry in plain language, still using only that entry.",
    },
  ];

  const frames = [
    { title: "A customer asks something new", body: "The FAQ doesn't cover it, so Sidekick says so instead of guessing." },
    { title: "It lands in your inbox", body: "In the customer's own words, with emails and phone numbers removed." },
    { title: "You answer it once", body: "From then on, every customer who asks gets your answer." },
  ];

  return (
    <>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <a href="/" className="inline-flex min-h-11 items-center" aria-label="Sidekick home">
            <Wordmark />
          </a>
          <nav aria-label="Main" className="flex items-center gap-1 text-[14px] sm:gap-2">
            <a href="#how" className="hidden min-h-11 items-center px-3 text-ink-2 underline-offset-4 hover:text-ink hover:underline md:inline-flex">
              How it decides
            </a>
            <a href="#install" className="hidden min-h-11 items-center px-3 text-ink-2 underline-offset-4 hover:text-ink hover:underline md:inline-flex">
              Install
            </a>
            <AdminEntry demo={demo} className="btn-primary min-h-10 px-3.5 text-[14px] sm:ml-2" />
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-page px-4 pb-24 pt-10 sm:px-6 lg:pb-36 lg:pt-14">
          <div className="anim-hero">
            <p style={{ "--i": 0 } as React.CSSProperties} className="label flex items-center gap-3 text-ink-2">
              <span aria-hidden="true" className="h-px w-8 bg-ink" />
              Support assistant for small shops
            </p>
            <h1
              style={{ "--i": 1 } as React.CSSProperties}
              className="display mt-5 text-[48px] leading-[50px] sm:text-[64px] sm:leading-[64px] lg:text-[80px] lg:leading-[80px] xl:text-[88px] xl:leading-[84px]"
            >
              Every answer cites your FAQ. <br className="hidden lg:block" />
              <em className="text-moss">Everything else</em> comes to you.
            </h1>
            <div style={{ "--i": 2 } as React.CSSProperties} className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-[54ch] text-[17px] leading-[28px] text-ink-2">
                A support assistant for small shops. It quotes the matching FAQ entry and shows which one. When nothing matches well enough, it says so and sends the question to the owner.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <AdminEntry demo={demo} className="btn-primary h-12 px-5" />
                <a href="#how" className="btn-secondary h-12 px-5">
                  How it decides
                </a>
              </div>
            </div>
            <div style={{ "--i": 3 } as React.CSSProperties} className="mt-10 lg:mt-12">
              <HeroDemo llmOn={llmOn} demo={demo} faqs={faqs} script={script} />
            </div>
          </div>
          <p className="mt-4 font-mono text-[12px] leading-4 text-ink-2">Fernbrook is a made-up shop with sample data.</p>
        </section>

        <section id="how" className="scroll-mt-4 border-t border-rule">
          <div className="mx-auto max-w-page px-4 py-24 sm:px-6 lg:py-36">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <h2 className={`${h2} lg:col-span-8`}>
                A chatbot invented a refund policy. <em>The airline had to pay.</em>
              </h2>
              <div className="lg:col-span-4 lg:pt-4">
                <p className="text-[16px] leading-[26px] text-ink-2">
                  In 2024, Air Canada&apos;s website chatbot told a grieving customer he could claim a bereavement discount after booking. The real policy said no. A British Columbia tribunal ruled that
                  the airline is responsible for everything on its website, chatbot included, and ordered it to refund part of the fare.
                </p>
                <p className="mt-6 flex items-center gap-3 border-t border-rule pt-4 font-mono text-[13px] leading-[18px] text-ink-2">
                  <span aria-hidden="true" className="text-moss">
                    &#167;
                  </span>
                  Moffatt v. Air Canada, 2024 BCCRT 149
                </p>
              </div>
            </div>

            <div className="mt-24 lg:mt-32">
              <h3 className="display text-[32px] leading-[36px]">Three checks before it answers</h3>
              <ol className="relative mt-12 grid gap-12 lg:grid-cols-3 lg:gap-12">
                <span aria-hidden="true" className="absolute bottom-6 left-[15px] top-4 w-px bg-moss lg:bottom-auto lg:left-4 lg:right-4 lg:top-[15px] lg:h-px lg:w-auto" />
                {steps.map((s, i) => (
                  <li key={s.title} className="relative pl-14 lg:pl-0 lg:pt-16">
                    <span aria-hidden="true" className="cite absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full bg-moss text-[12px] text-white ring-4 ring-paper">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[20px] font-semibold leading-7">{s.title}</p>
                    <p className="mt-2 max-w-[44ch] text-[15px] leading-6 text-ink-2">{s.body}</p>
                    <div aria-hidden="true" className="mt-6 max-w-[380px]">
                      {i === 0 && sampleSource && (
                        <div className="space-y-2">
                          <p className="ml-auto w-fit rounded-lg rounded-br-xs bg-ink px-3 py-1.5 text-[14px] leading-5 text-paper">{sample?.question}</p>
                          <div className="grid grid-cols-[44px_minmax(0,1fr)] rounded-xs bg-moss-tint py-2 pr-3 text-[14px] leading-5 shadow-[inset_2px_0_0_#1D5A3C]">
                            <span className="cite pl-2.5 text-[12px] leading-5 text-moss">{sampleCite ? citeLabel(sampleCite.n) : "§"}</span>
                            <span className="font-medium text-moss">{sampleSource.question}</span>
                          </div>
                        </div>
                      )}
                      {i === 1 && sampleStrength !== null && (
                        <div className="card px-4 pb-4 pt-3">
                          <MatchScale strength={sampleStrength} threshold={pct} />
                        </div>
                      )}
                      {i === 2 && (
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-2 rounded-sm border border-rule bg-sheet px-2.5 py-1.5 text-[13px] leading-[18px]">
                            <span className="cite rounded-xs bg-moss px-1.5 py-0.5 text-[12px] leading-4 text-white">{sampleCite ? citeLabel(sampleCite.n) : "§"}</span>
                            Quoted from the entry
                          </span>
                          <span className="inline-flex items-center rounded-sm border border-dashed border-ember/60 bg-ember-tint px-2.5 py-1.5 font-mono text-[12px] leading-4 text-ember-dark">
                            Or sent to the owner
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="owner" className="border-t border-rule">
          <div className="mx-auto max-w-page px-4 py-24 sm:px-6 lg:py-36">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
              <h2 className={`${h2} lg:col-span-7`}>
                Unanswered questions become your <em>next FAQ entry</em>
              </h2>
              <div className="lg:col-span-5">
                <p className="text-[16px] leading-[26px] text-ink-2">
                  Questions the FAQ can&apos;t answer wait in your inbox, in the customer&apos;s own words. Write the answer once and it&apos;s live for every customer after that. Delete an entry and
                  Sidekick stops using it.
                </p>
                <div className="mt-6">
                  <AdminEntry demo={demo} className="btn-primary h-12 px-5" />
                </div>
              </div>
            </div>

            <ol className="mt-16 grid gap-10 lg:mt-20 lg:grid-cols-3 lg:gap-6">
              {frames.map((f, i) => (
                <li key={f.title} className="flex flex-col">
                  <p className="flex items-baseline gap-3 border-t border-ink pt-3">
                    <span className="cite text-[13px] text-moss">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[17px] font-semibold leading-6">{f.title}</span>
                  </p>
                  <p className="mb-5 mt-1.5 pl-8 text-[15px] leading-6 text-ink-2">{f.body}</p>
                  <div aria-hidden="true" className="card mt-auto min-h-[236px] p-5">
                    {i === 0 && (
                      <div className="space-y-3">
                        <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-xs bg-ink px-3.5 py-2 text-[14px] leading-5 text-paper">{NEW_QUESTION}</p>
                        <p className="label flex items-center gap-2 text-ember-dark">
                          <span className="h-px w-4 bg-ember" />
                          Not in the FAQ
                        </p>
                        <p className="border-l-2 border-ember pl-3 text-[14px] leading-[21px]">{UNKNOWN_TEXT.split(". ")[0]}.</p>
                        <p className="inline-flex rounded-sm border border-dashed border-ember/60 bg-ember-tint px-2.5 py-1 font-mono text-[12px] leading-4 text-ember-dark">Sent to the owner</p>
                      </div>
                    )}
                    {i === 1 && (
                      <div>
                        <p className="label text-ember-dark">Open &middot; just now</p>
                        <p className="display mt-1.5 text-[22px] leading-7">&ldquo;{NEW_QUESTION}&rdquo;</p>
                        <div className="mt-3 rounded-sm border border-ink bg-sheet px-3 py-2 text-[14px] leading-[21px]">
                          {NEW_ANSWER}
                          <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-ink" />
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="inline-flex min-h-9 items-center rounded-sm bg-moss px-3 text-[14px] font-medium text-white">Add to FAQ</span>
                          <span className="font-mono text-[12px] text-ink-2">Ctrl + Enter</span>
                        </div>
                      </div>
                    )}
                    {i === 2 && (
                      <div className="space-y-3">
                        <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-xs bg-ink px-3.5 py-2 text-[14px] leading-5 text-paper">{NEW_QUESTION}</p>
                        <div className="rounded-lg rounded-bl-xs bg-paper px-3.5 pt-2.5 text-[14px] leading-[21px]">
                          {NEW_ANSWER}
                          <p className="mt-2.5 flex min-h-10 items-center gap-2 border-t border-rule text-[13px] text-ink-2">
                            <span className="cite rounded-xs bg-moss px-1.5 py-0.5 text-[12px] leading-4 text-white">&#167; new</span>
                            General &middot; your answer
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="install" className="on-night scroll-mt-4 bg-night text-night-ink">
          <div className="mx-auto max-w-page px-4 py-24 sm:px-6 lg:py-36">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="min-w-0 lg:col-span-5">
                <p className="label text-night-2">Install</p>
                <h2 className={`${h2} mt-5`}>
                  One script tag. <em>Any site.</em>
                </h2>
                <p className="mt-6 max-w-[48ch] text-[16px] leading-[26px] text-night-2">
                  Paste this before the closing body tag. It adds a chat button in the corner and opens the assistant in a frame, so your site&apos;s styles and scripts can&apos;t break it.
                </p>
                <a href="/embed-demo.html" className="mt-6 inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-night-ink underline decoration-night-2 underline-offset-4 hover:decoration-night-ink">
                  See it on a sample third-party page
                  <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
              <div className="min-w-0 self-center lg:col-span-7">
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-night-rule bg-black/25 p-6 font-mono text-[15px] leading-7 sm:p-8 sm:text-[19px] sm:leading-9">
                  <code>
                    <span className="text-night-2">&lt;</span>
                    <span className="text-marker">script</span> <span className="text-[#A9CDB6]">src</span>
                    <span className="text-night-2">=</span>
                    <span className="text-night-ink">&quot;https://YOUR-DOMAIN/embed.js&quot;</span> <span className="text-[#A9CDB6]">async</span>
                    <span className="text-night-2">&gt;&lt;/</span>
                    <span className="text-marker">script</span>
                    <span className="text-night-2">&gt;</span>
                  </code>
                </pre>
              </div>
            </div>

            <div className="mt-24 grid gap-10 border-t border-night-rule pt-16 lg:mt-32 lg:grid-cols-12 lg:gap-12">
              <h2 id="build" className="display text-[32px] leading-[36px] sm:text-[40px] sm:leading-[44px] lg:col-span-4">
                Build notes
              </h2>
              <dl className="grid gap-10 md:grid-cols-3 lg:col-span-8">
                <div>
                  <dt className="label text-night-2">The problem</dt>
                  <dd className="mt-3 text-[15px] leading-6 text-night-ink">
                    Small shops want to answer customers around the clock, but a bot that invents a policy can cost them money and trust.
                  </dd>
                </div>
                <div>
                  <dt className="label text-night-2">The approach</dt>
                  <dd className="mt-3 text-[15px] leading-6 text-night-ink">
                    Keyword retrieval with a {pct}% match bar, answers quoted straight from the FAQ, unanswered questions routed to the owner, and an optional language-model step that only ever sees one
                    entry.
                  </dd>
                </div>
                <div>
                  <dt className="label text-night-2">What it does</dt>
                  <dd className="mt-3 text-[15px] leading-6 text-night-ink">
                    A widget that installs with one line and answers only from the FAQ. Emails and phone numbers are removed before a chat is stored, and automated tests cover matching and refusals.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark />
          <p className="text-[13px] leading-[18px] text-ink-2">Demo project. Sample shop and FAQ. Conversations come from visitors to this demo.</p>
        </div>
      </footer>
    </>
  );
}
