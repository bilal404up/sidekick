import "./admin.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";
import { listConversations, listFaqs, listUnanswered } from "@/lib/store";
import { AdminConsole, type ConversationItem, type FaqItem, type UnansweredItem } from "@/components/AdminConsole";
import { SignOut } from "@/components/SignOut";
import { SidekickMark } from "@/components/SidekickMark";

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
      <header className="on-cabinet bg-cabinet text-card">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <a href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-[24px] leading-none text-card">
            <SidekickMark className="text-brass" />
            sidekick
            <span className="font-sans text-[15px] font-bold text-card-dim">admin</span>
          </a>
          <SignOut className="btn border border-brass text-card hover:bg-cabinet-raised" />
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:py-10">
        <h1 className="text-[32px] leading-[36px]">Fernbrook Garden Supply</h1>
        <p className="mb-8 mt-2 max-w-[62ch] text-[16px] leading-6 text-ink-muted">
          What the shop owner sees. Questions the assistant couldn&apos;t answer wait in the tray. Write the answer once and the assistant knows it from then on.
        </p>
        {data ? (
          <AdminConsole {...data} />
        ) : (
          <p role="alert" className="rounded-md border border-error bg-card p-4 text-[15px] leading-[22px] text-error">
            Could not load the data. Check the database connection and reload.
          </p>
        )}
      </main>
    </>
  );
}
