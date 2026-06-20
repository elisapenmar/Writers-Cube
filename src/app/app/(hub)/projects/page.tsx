import Link from "next/link";
import {
  listProjects,
  getActiveProjectId,
  openProject,
  createProjectAndOpen,
} from "@/server/projects";

export default async function ProjectsPage() {
  const [projects, activeProjectId] = await Promise.all([
    listProjects(),
    getActiveProjectId(),
  ]);

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <Link href="/app" className="text-xs text-zinc-500 hover:underline">
              ← Dashboard
            </Link>
            <h1 className="font-serif text-2xl text-[var(--wc-ink)] mt-1">
              All projects
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map((p) => (
            <form key={p.id} action={openProject}>
              <input type="hidden" name="projectId" value={p.id} />
              <button
                type="submit"
                className={`w-full text-left rounded-2xl p-4 border bg-white hover:border-zinc-300 transition ${
                  p.id === activeProjectId
                    ? "border-[var(--wc-slate)]"
                    : "border-zinc-200"
                }`}
              >
                <div className="font-serif text-lg text-[var(--wc-ink)]">
                  {p.title}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {p.word_count.toLocaleString()} words · {p.chapter_count}{" "}
                  chapter{p.chapter_count === 1 ? "" : "s"}
                  {p.id === activeProjectId && " · open"}
                </div>
              </button>
            </form>
          ))}

          <form
            action={createProjectAndOpen}
            className="rounded-2xl p-4 border border-dashed border-zinc-300 bg-transparent flex items-center gap-2"
          >
            <input
              name="title"
              placeholder="New project title…"
              className="flex-1 bg-white rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-white"
              style={{ background: "var(--wc-slate)" }}
            >
              Create
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
