import Link from "next/link";

type Evidence = {
  n: number;
  title: string;
  finding: string;
  use: string;
  sources: string;
};

const EVIDENCE: Evidence[] = [
  {
    n: 1,
    title: "Constraints don't limit creativity — they fuel it",
    finding:
      "A review of roughly 145 empirical studies found the relationship between constraints and creativity forms an inverted-U: a moderate amount of constraint produces the most creative output, while too little breeds complacency and too much stifles. Constraints push people off the path of least resistance, and task cues prime semantic memory to surface remote, original associations.",
    use: "Every craft exercise carries a specific rule (“no dialogue tags,” “reveal personality without naming a trait”). The rule is the engine, not decoration.",
    sources: "Sources 1, 2",
  },
  {
    n: 2,
    title: "Timed, low-stakes prompts reduce the fear of the blank page",
    finding:
      "Peter Elbow's freewriting — brief, timed, non-editing bursts — has a research literature showing it reduces writing apprehension, builds confidence, and increases fluency (ideas generated per fixed time). A 2025 study of secondary EFL learners found freewriting improved both writing fluency and writers' emotions and perceptions of the task.",
    use: "The “warm-up (~5 min)” framing and the optional typewriter mode (write without editing until you hit a word or time goal) are freewriting made into a button.",
    sources: "Sources 3, 4",
  },
  {
    n: 3,
    title: "Repeated prompted practice measurably improves writing",
    finding:
      "Education research treats prompts as serving two proven roles: quick-writes for fluency and developed prompts for process writing. Meta-analyses of writing instruction find structured, repeated practice reliably improves writing skill — partly because automaticity with the basics frees cognitive space for composition.",
    use: "The whole tool is built to be replayable — roll another, go deeper, come back tomorrow.",
    sources: "Source 5",
  },
  {
    n: 4,
    title: "The craft tradition behind the exercises",
    finding:
      "The specific exercise patterns — describe a character's room when they're absent, write the scene before the story begins, render a place with only sound and smell — come from the standard creative-writing exercise canon used in MFA programs and workshops.",
    use: "Authored exemplars are drawn from that canon; the engine recombines and grounds them in your work.",
    sources: "Sources 6, 7",
  },
];

const SOURCES: { label: string; href?: string }[] = [
  {
    label:
      "Acar, Tarakci & van Knippenberg — Creativity from constraints: Theory and applications to education. Thinking Skills & Creativity.",
  },
  {
    label:
      "Sassenberg et al. — Priming creativity as a strategy to increase creative performance by facilitating the activation of remote associations. J. Experimental Social Psychology.",
  },
  {
    label:
      "Choi (2025) — Effects of Freewriting on L2 Writing Fluency, Emotions, and Perceptions. International Journal of Applied Linguistics.",
  },
  {
    label: "Using Focused Freewriting to Stimulate Ideas (ERIC) — Elbow tradition.",
  },
  {
    label:
      "Graham et al. — Writing instruction meta-analysis. Educational Research Review.",
  },
  {
    label: "Bernays & Painter — What If? Writing Exercises for Fiction Writers.",
  },
  { label: "Kiteley — The 3 A.M. Epiphany." },
];

export default function WhyThisWorks() {
  return (
    <div className="flex-1 overflow-y-auto wc-cream">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/app/prompts" className="text-xs text-[var(--wc-slate)] hover:underline">
          ← Back to the prompts
        </Link>
        <h1 className="font-serif text-3xl text-[var(--wc-ink)] mt-2">
          Why warm-up prompts actually work
        </h1>
        <p className="text-zinc-600 mt-2 leading-relaxed">
          The short version: constraints spark ideas, timed low-stakes writing
          lowers the fear, and repeated practice builds fluency. Here&apos;s the
          evidence.
        </p>

        <div className="mt-8 space-y-5">
          {EVIDENCE.map((e) => (
            <section
              key={e.n}
              className="rounded-2xl wc-paper border border-[rgba(33,31,41,0.08)] p-5"
            >
              <div className="flex items-baseline gap-2 mb-2">
                <span
                  className="text-xs font-semibold text-white grid place-items-center w-5 h-5 rounded-md shrink-0"
                  style={{ background: "var(--wc-slate)" }}
                >
                  {e.n}
                </span>
                <h2 className="font-serif text-lg text-[var(--wc-ink)]">{e.title}</h2>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed">{e.finding}</p>
              <p className="text-sm text-zinc-600 leading-relaxed mt-2">
                <b>How we use it:</b> {e.use}
              </p>
              <p className="text-[11px] text-zinc-400 mt-2">{e.sources}</p>
            </section>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-[rgba(224,168,46,0.4)] bg-[rgba(224,168,46,0.08)] p-5">
          <div className="font-serif text-base text-[var(--wc-ink)] mb-1">
            An honest caveat
          </div>
          <p className="text-sm text-zinc-700 leading-relaxed">
            Most of this evidence comes from composition studies, education
            research, and creativity psychology — not from controlled trials on
            novelists revising long manuscripts. The &ldquo;help me deepen my
            existing draft&rdquo; use case rests on a strong craft tradition
            rather than experimental proof. We think that&apos;s worth saying out
            loud.
          </p>
        </div>

        <div className="mt-8">
          <h3 className="font-serif text-lg text-[var(--wc-ink)] mb-2">
            Academic &amp; primary sources
          </h3>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-zinc-600">
            {SOURCES.map((s, i) => (
              <li key={i}>{s.label}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
