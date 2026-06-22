import Link from "next/link";
import { listArchivedProjects } from "@/server/projects";
import { ArchiveList } from "@/components/archive-list";

export default async function ArchivePage() {
  const archived = await listArchivedProjects();

  return (
    <div className="flex-1 overflow-y-auto wc-cube-bg">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--wc-slate)]">
              Archive
            </div>
            <h1 className="font-serif text-3xl text-[var(--wc-ink)]">Archived projects</h1>
            <p className="mt-1 text-sm text-[var(--wc-muted)]">
              Restore a project to bring it back, or delete it permanently.
            </p>
          </div>
          <Link href="/app" className="text-xs text-[var(--wc-slate)] hover:underline">
            ← Back
          </Link>
        </header>

        {archived.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--wc-border-strong)] px-4 py-8 text-center text-sm text-[var(--wc-faint)]">
            Nothing archived. Archive a project from the ⋯ menu on its card.
          </p>
        ) : (
          <ArchiveList
            projects={archived.map((p) => ({
              id: p.id,
              title: p.title,
              words: p.word_count,
              chapters: p.chapter_count,
              archivedAt: p.archived_at,
            }))}
          />
        )}
      </div>
    </div>
  );
}
