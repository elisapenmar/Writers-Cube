import { importManuscript } from "@/server/import";

const FORMATS: { id: string; label: string; note: string }[] = [
  { id: "docx", label: "Word (.docx)", note: "Agents, editors, Word & Google Docs" },
  { id: "md", label: "Markdown (.md)", note: "Portable across writing tools" },
  { id: "txt", label: "Plain text (.txt)", note: "Universal, no formatting" },
  { id: "html", label: "Web page (.html)", note: "Open in a browser → print to PDF" },
];

export function ImportExport() {
  return (
    <section>
      <h2 className="font-serif text-xl text-[var(--wc-ink)] mb-1">
        Import &amp; export
      </h2>
      <p className="text-xs text-zinc-500 mb-3">
        Bring a draft in, or take the active project out in the format you need.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Export */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="font-serif text-base text-[var(--wc-ink)] mb-2">
            Export the active project
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {FORMATS.map((f) => (
              <a
                key={f.id}
                href={`/app/export?format=${f.id}`}
                download
                className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span className="text-sm text-zinc-800">{f.label}</span>
                <span className="text-[11px] text-zinc-400">{f.note}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Import */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="font-serif text-base text-[var(--wc-ink)] mb-2">
            Import a manuscript
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Upload a <b>.docx</b>, <b>.md</b>, or <b>.txt</b>. Headings become
            chapters; <span className="font-mono">* * *</span> or{" "}
            <span className="font-mono">#</span> split scenes. It lands in a new
            project.
          </p>
          <form action={importManuscript} className="flex flex-col gap-2">
            <input
              type="file"
              name="file"
              accept=".docx,.md,.markdown,.txt"
              required
              className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-zinc-700 hover:file:bg-zinc-200"
            />
            <button
              type="submit"
              className="self-start rounded-xl px-4 py-2 text-sm text-white"
              style={{ background: "var(--wc-slate)" }}
            >
              Import to a new project
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
