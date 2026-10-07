import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { listConversations, listFaqs, listUnanswered } from "@/lib/store";
import { AdminConsole, type ConversationItem, type FaqItem, type UnansweredItem } from "@/components/AdminConsole";
import { SignOut } from "@/components/SignOut";

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
      <header className="border-b border-ink bg-paper-raised">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="font-display text-[22px] leading-none">sidekick <span className="text-[15px] font-medium text-ink-muted">admin</span></a>
          <SignOut />
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <h1 className="text-[28px] leading-[34px]">Fernbrook Garden Supply</h1>
        <p className="mb-6 mt-1 max-w-[60ch] text-[15px] leading-[22px] text-ink-muted">
          What the shop owner sees. Questions the assistant could not answer wait in the first tab. Add an answer and the assistant knows it from then on.
        </p>
        {data ? (
          <AdminConsole {...data} />
        ) : (
          <p role="alert" className="rounded-md border border-error bg-paper-raised p-4 text-[15px] text-error">
            Could not load the data. Check the database connection and reload.
          </p>
        )}
      </main>
    </>
  );
}
