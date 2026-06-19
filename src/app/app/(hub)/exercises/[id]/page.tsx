import Link from "next/link";
import { notFound } from "next/navigation";
import { getExercise } from "@/server/prompts";
import { DeleteExerciseButton } from "@/components/delete-exercise-button";

type DocNode = {
  type?: string;
  text?: string;
  content?: DocNode[];
  attrs?: { level?: number };
};

function renderDoc(doc: unknown, keyPrefix = "n"): React.ReactNode {
  const node = doc as DocNode | null;
  if (!node) return null;
  if (node.type === "text") return node.text ?? "";
  const children = (node.content ?? []).map((c, i) =>
    renderDoc(c, `${keyPrefix}-${i}`),
  );
  switch (node.type) {
    case "doc":
      return <>{children}</>;
    case "paragraph":
      return (
        <p key={keyPrefix} className="mb-4">
          {children.length ? children : <br />}
        </p>
      );
    case "heading": {
      const lvl = node.attrs?.level ?? 2;
      const Tag = (`h${Math.min(Math.max(lvl, 1), 3)}`) as "h1" | "h2" | "h3";
      return (
        <Tag key={keyPrefix} className="font-serif text-xl mt-4 mb-2">
          {children}
        </Tag>
      );
    }
    case "bulletList":
      return <ul key={keyPrefix} className="list-disc pl-5 mb-4">{children}</ul>;
    case "orderedList":
      return <ol key={keyPrefix} className="list-decimal pl-5 mb-4">{children}</ol>;
    case "listItem":
      return <li key={keyPrefix}>{children}</li>;
    case "blockquote":
      return (
        <blockquote key={keyPrefix} className="border-l-2 border-zinc-300 pl-4 italic mb-4">
          {children}
        </blockquote>
      );
    default:
      return <span key={keyPrefix}>{children}</span>;
  }
}

export default async function ExerciseView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ex = await getExercise(id).catch(() => null);
  if (!ex) notFound();

  const backHref = ex.project_id
    ? `/app/exercises?project=${ex.project_id}`
    : "/app/exercises";

  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href={backHref} className="text-xs text-[var(--wc-slate)] hover:underline">
          ← {ex.project_id ? "Prompted exercises" : "Practice library"}
        </Link>

        {/* The prompt */}
        <div className="mt-3 rounded-2xl wc-paper border border-[rgba(33,31,41,0.08)] p-5">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] text-zinc-500">
            <span>{ex.format === "seed" ? "Scenario seed" : "Craft exercise"}</span>
            <span>·</span>
            <span>{ex.focus}</span>
            <span>·</span>
            <span>{ex.depth === "deep" ? "Deep dive" : "Warm-up"}</span>
          </div>
          <p className="font-serif text-lg text-[var(--wc-ink)] leading-relaxed">
            {ex.prompt?.text}
          </p>
          {ex.prompt?.question && (
            <p className="font-serif text-base italic text-zinc-700 mt-1">
              {ex.prompt.question}
            </p>
          )}
          {ex.prompt?.constraint && (
            <p className="mt-2 text-sm text-[var(--wc-terracotta)]">
              <b>Constraint:</b> {ex.prompt.constraint}
            </p>
          )}
        </div>

        {/* What was written */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2">
            What you wrote · {ex.word_count.toLocaleString()} words
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 font-serif text-lg leading-relaxed text-zinc-800">
            {ex.content ? renderDoc(ex.content) : (
              <span className="italic text-zinc-400">Nothing was saved for this exercise.</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Link
            href="/app/prompts"
            className="rounded-xl px-4 py-2 text-sm text-white"
            style={{ background: "var(--wc-terracotta)" }}
          >
            Reuse this kind of prompt
          </Link>
          <DeleteExerciseButton id={ex.id} backHref={backHref} />
        </div>
      </div>
    </div>
  );
}
