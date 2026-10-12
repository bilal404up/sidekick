import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { listConversations, listFaqs, listUnanswered } from "@/lib/store";
import { AdminConsole, type ConversationItem, type FaqItem, type UnansweredItem } from "@/components/AdminConsole";
import { SignOut } from "@/components/SignOut";
import { Wordmark } from "@/components/Wordmark";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sidekick admin" };

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
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <a href="/" className="inline-flex min-h-11 items-center">
            <Wordmark suffix="Owner" />
          </a>
          <SignOut />
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
        <h1 className="text-[28px] leading-[34px] sm:text-[32px] sm:leading-[38px]">Fernbrook Garden Supply</h1>
        <p className="mb-8 mt-2 max-w-[62ch] text-[15px] leading-[23px] text-ink-muted">
          What the shop owner sees. Questions the assistant couldn&apos;t answer wait in the inbox. Add an answer once and the assistant uses it from then on.
        </p>
        {data ? (
          <AdminConsole {...data} />
        ) : (
          <p role="alert" className="rounded-xl border border-error/40 bg-surface p-4 text-[15px] leading-[22px] text-error">
            Could not load the data. Check the database connection and reload.
          </p>
        )}
      </main>
    </>
  );
}
