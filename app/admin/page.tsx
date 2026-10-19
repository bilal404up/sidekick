import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { listConversations, listFaqs, listUnanswered } from "@/lib/store";
import { AdminConsole, type ConversationItem, type FaqItem, type UnansweredItem } from "@/components/AdminConsole";
import { SignOut } from "@/components/SignOut";
import { Wordmark } from "@/components/Wordmark";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sidekick owner view" };

export default async function AdminPage() {
  if (!verifyAdminToken(cookies().get(ADMIN_COOKIE)?.value)) redirect("/admin/login");

  let data: { unanswered: UnansweredItem[]; conversations: ConversationItem[]; faqs: FaqItem[] } | null = null;
  try {
    const [unanswered, conversations, faqs] = await Promise.all([listUnanswered("open"), listConversations(40), listFaqs()]);
    data = { unanswered: unanswered as UnansweredItem[], conversations, faqs: faqs as FaqItem[] };
  } catch {
    data = null;
  }

  return (
    <>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <a href="/" className="inline-flex min-h-11 min-w-0 items-center" aria-label="Sidekick home">
            <Wordmark suffix="Owner view" />
          </a>
          <div className="flex items-center gap-4">
            <span className="label hidden text-ink-2 md:inline">Fernbrook Garden Supply</span>
            <SignOut className="btn-secondary min-h-10 px-3.5 text-[14px]" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-page px-4 pb-24 pt-10 sm:px-6 lg:pt-14">
        <p className="label text-ink-2">Owner view</p>
        <h1 className="display mt-3 text-[40px] leading-[44px] sm:text-[56px] sm:leading-[58px]">Fernbrook Garden Supply</h1>
        <p className="mb-10 mt-4 max-w-[60ch] text-[16px] leading-[26px] text-ink-2">
          Questions the assistant could not answer wait here. Answer once and it uses your answer from then on.
        </p>
        {data ? (
          <AdminConsole {...data} />
        ) : (
          <p role="alert" className="rounded-lg border border-error/40 bg-sheet p-4 text-[15px] leading-[22px] text-error">
            Could not load the data. Check the database connection and reload.
          </p>
        )}
      </main>
    </>
  );
}
