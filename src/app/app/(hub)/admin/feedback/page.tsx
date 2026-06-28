import { notFound } from "next/navigation";
import Link from "next/link";
import { SquareArrow } from "@/components/icons";
import { isAdmin, listFeedback } from "@/server/feedback";
import { FeedbackAdminList } from "@/components/feedback-admin-list";

export default async function FeedbackAdminPage() {
  if (!(await isAdmin())) notFound();
  const entries = await listFeedback();

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-5">
        <div>
          <Link href="/app" className="text-xs text-[var(--wc-faint)] hover:underline">
            <SquareArrow dir="left" className="inline-block align-[-3px] mr-1" /> Dashboard
          </Link>
          <h1 className="font-serif text-2xl text-[var(--wc-ink)] mt-1">Feedback</h1>
          <p className="text-xs text-[var(--wc-faint)]">
            {entries.length} {entries.length === 1 ? "response" : "responses"} · newest first
          </p>
        </div>
        <FeedbackAdminList initial={entries} />
      </div>
    </div>
  );
}
