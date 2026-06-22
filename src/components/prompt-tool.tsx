"use client";

import Link from "next/link";
import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Indent } from "@/lib/indent";
import { generatePrompt, saveExercise } from "@/server/prompts";
import { setActiveProject } from "@/server/projects";
import { FOCUS_META, type PromptFocus, type PromptDepth } from "@/lib/prompt-library";
import type { RenderedPrompt, Segment, EntityBag } from "@/lib/prompt-fill";
import { TypewriterMode } from "@/components/typewriter-mode";
import { EditorToolbar } from "@/components/editor-toolbar";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { TagBubbleMenu } from "@/components/tag-bubble-menu";

type Mode = "new" | "existing";
type WritingMode = "free" | "typewriter";
type GoalType = "words" | "minutes";

// Carved-wood die faces. Add the rest (plot, dialogue, sensory) the same way.
const FOCUS_IMAGE: Partial<Record<PromptFocus, string>> = {
  character: "/focus/character.png",
  setting: "/focus/setting.png",
  voice: "/focus/voice.png",
};

const FOCUS_ORDER: PromptFocus[] = [
  "character",
  "setting",
  "plot",
  "voice",
  "dialogue",
  "sensory",
];

function countWords(doc: unknown): number {
  let text = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") text += " " + node.text;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function Segments({ segs }: { segs: Segment[] | undefined }) {
  if (!segs) return null;
  return (
    <>
      {segs.map((s, i) =>
        s.injected ? (
          <span key={i} className="wc-injected">
            {s.t}
          </span>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
    </>
  );
}

export function PromptTool({
  projects,
  activeProjectId,
}: {
  projects: { id: string; title: string }[];
  activeProjectId: string | null;
}) {
  const [mode, setMode] = useState<Mode>("new");
  const [projectId, setProjectId] = useState<string | null>(
    activeProjectId ?? projects[0]?.id ?? null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const [focuses, setFocuses] = useState<Set<PromptFocus>>(new Set());
  const [scenarioSeed, setScenarioSeed] = useState(false);
  const [depth, setDepth] = useState<PromptDepth>("warmup");
  const [writingMode, setWritingMode] = useState<WritingMode>("free");
  const [goalType, setGoalType] = useState<GoalType>("words");
  const [goalValue, setGoalValue] = useState<number>(250);

  const [rendered, setRendered] = useState<RenderedPrompt | null>(null);
  const [entities, setEntities] = useState<EntityBag | null>(null);
  const [showDeeper, setShowDeeper] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tumbling, setTumbling] = useState(false);
  const [saved, setSaved] = useState(false);

  // Free-write surface
  const [writeOpen, setWriteOpen] = useState(false);
  const [typewriterOpen, setTypewriterOpen] = useState(false);

  function toggleFocus(f: PromptFocus) {
    setFocuses((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function rollDie() {
    setTumbling(true);
    setTimeout(() => setTumbling(false), 520);
    // 1–3 random selections across the 6 focuses + scenario-seed.
    const options: ("seed" | PromptFocus)[] = [...FOCUS_ORDER, "seed"];
    const n = 1 + Math.floor(Math.random() * 3);
    const pool = [...options];
    const chosen: ("seed" | PromptFocus)[] = [];
    while (chosen.length < n && pool.length) {
      chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    const nextFocuses = new Set<PromptFocus>();
    let seed = false;
    for (const c of chosen) {
      if (c === "seed") seed = true;
      else nextFocuses.add(c);
    }
    setFocuses(nextFocuses);
    setScenarioSeed(seed);
  }

  async function rollAndWrite() {
    setError(null);
    setSaved(false);
    setShowDeeper(false);
    setGenerating(true);
    try {
      const result = await generatePrompt({
        focuses: [...focuses],
        scenarioSeed,
        depth,
        mode,
        projectId: mode === "existing" ? projectId : null,
      });
      if (!result.rendered) {
        setError(result.message ?? "Could not generate a prompt.");
        return;
      }
      setRendered(result.rendered);
      setEntities(result.entities ?? null);
      // Open the writing surface together with the prompt.
      if (writingMode === "typewriter") {
        setTypewriterOpen(true);
        setWriteOpen(false);
      } else {
        setWriteOpen(true);
        setTypewriterOpen(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function persistExercise(content: unknown, wordCount: number) {
    if (!rendered) return;
    if (wordCount <= 0) {
      // Nothing written — don't clutter the practice library with blanks.
      throw new Error("Write something first — empty exercises aren't saved.");
    }
    await saveExercise({
      projectId: mode === "existing" ? projectId : null,
      rendered,
      promptMode: mode,
      writingMode,
      goalType: writingMode === "typewriter" ? goalType : null,
      goalValue: writingMode === "typewriter" ? goalValue : null,
      content,
      wordCount,
    });
  }

  const hasRolled = rendered !== null;
  const activeProjectTitle =
    projects.find((p) => p.id === projectId)?.title ?? "your project";

  return (
    <div className="flex-1 overflow-y-auto wc-cube-bg">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--wc-slate)]">
                Writer&apos;s Cube
              </div>
              <h1 className="font-serif text-3xl text-[var(--wc-ink)] mt-0.5">
                Writing prompts
              </h1>
              <p className="text-sm text-zinc-600 mt-1">
                Roll your way out of the block.
              </p>
            </div>
            <Link
              href="/app/why-this-works"
              className="text-xs text-[var(--wc-slate)] hover:underline"
            >
              Why this works
            </Link>
          </div>
        </header>

        {/* Step 1 — Mode */}
        <Section n={1} title="What are we doing?">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ModeCard
              active={mode === "new"}
              title="Start something new"
              blurb="Standalone warm-ups. The cube invents all the specifics."
              onClick={() => setMode("new")}
            />
            <ModeCard
              active={mode === "existing"}
              title="Help me with my story"
              blurb="Prompts grounded in your real characters, places, and threads."
              onClick={() => {
                if (projects.length === 0) {
                  setError("Create a project first to ground prompts in your draft.");
                  return;
                }
                setPickerOpen(true);
              }}
            />
          </div>
          {mode === "existing" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
              <span>
                Grounding in <b>{activeProjectTitle}</b>.
              </span>
              <button
                onClick={() => setPickerOpen(true)}
                className="text-[var(--wc-slate)] hover:underline"
              >
                Switch project
              </button>
            </div>
          )}
          {mode === "existing" && entities && (
            <EntityPanel entities={entities} />
          )}
        </Section>

        {/* Step 2 — What to work on */}
        <Section n={2} title="What to work on" hint="Pick any number, or roll the die.">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {FOCUS_ORDER.map((f) => (
              <DieFace
                key={f}
                label={FOCUS_META[f].label}
                pips={FOCUS_META[f].pips}
                image={FOCUS_IMAGE[f]}
                selected={focuses.has(f)}
                onClick={() => toggleFocus(f)}
              />
            ))}
            <DieFace
              label="Scenario seed"
              seed
              selected={scenarioSeed}
              onClick={() => setScenarioSeed((v) => !v)}
            />
            <button
              onClick={rollDie}
              className={`wc-randomizer rounded-2xl aspect-square grid place-items-center text-[var(--wc-ink)] font-semibold ${
                tumbling ? "wc-tumbling" : ""
              }`}
              title="Roll 1–3 random faces"
            >
              <span className="text-2xl">🎲</span>
            </button>
          </div>
          {scenarioSeed && (
            <p className="mt-2 text-xs text-[var(--wc-plum)]">
              Scenario seed sets the format — other faces act as topic filters for seeds.
            </p>
          )}
        </Section>

        {/* Step 3 — Depth & writing mode */}
        <Section n={3} title="Depth & writing mode">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="text-xs text-zinc-500 mb-1.5 uppercase tracking-wide">Depth</div>
              <div className="flex gap-2">
                <Pill active={depth === "warmup"} onClick={() => setDepth("warmup")}>
                  Warm-up · ~5 min
                </Pill>
                <Pill active={depth === "deep"} onClick={() => setDepth("deep")}>
                  Deep dive
                </Pill>
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1.5 uppercase tracking-wide">Writing mode</div>
              <div className="flex gap-2 items-center">
                <Pill active={writingMode === "free"} onClick={() => setWritingMode("free")}>
                  Free write
                </Pill>
                <Pill active={writingMode === "typewriter"} onClick={() => setWritingMode("typewriter")}>
                  Typewriter (locked)
                </Pill>
                {writingMode === "typewriter" && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <input
                      type="number"
                      min={1}
                      value={goalValue}
                      onChange={(e) => setGoalValue(Math.max(1, parseInt(e.target.value || "0", 10)))}
                      className="w-16 rounded-md border border-zinc-300 px-2 py-1 bg-white"
                    />
                    <select
                      value={goalType}
                      onChange={(e) => setGoalType(e.target.value as GoalType)}
                      className="rounded-md border border-zinc-300 px-1.5 py-1 bg-white"
                    >
                      <option value="words">words</option>
                      <option value="minutes">minutes</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* Prompt card */}
        <div className="mt-8 wc-paper rounded-3xl border border-[rgba(33,31,41,0.08)] shadow-[0_8px_30px_rgba(33,31,41,0.08)] p-6">
          {!hasRolled ? (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500 mb-5">
                {mode === "existing"
                  ? "Grounded in your draft. Roll to begin."
                  : "Set your filters (or just roll). Rolling opens the prompt and your writing surface together."}
              </p>
              <button
                onClick={rollAndWrite}
                disabled={generating}
                className="rounded-2xl px-7 py-3 text-[var(--wc-on-accent)] font-medium shadow-lg disabled:opacity-50"
                style={{ background: "var(--wc-terracotta)" }}
              >
                {generating ? "Rolling…" : "🎲 Roll & write"}
              </button>
              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            </div>
          ) : (
            <div>
              <PromptCard
                rendered={rendered!}
                showDeeper={showDeeper}
              />
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              {/* Actions — directly above the writing surface */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={rollAndWrite}
                  disabled={generating}
                  className="rounded-xl px-4 py-2 text-sm border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {generating ? "Rolling…" : "↻ Not for me — reroll"}
                </button>
                <button
                  onClick={() => setShowDeeper((v) => !v)}
                  className="rounded-xl px-4 py-2 text-sm border border-zinc-300 hover:bg-zinc-50"
                >
                  {showDeeper ? "Hide deeper" : "Go deeper"}
                </button>
                {writingMode === "typewriter" && (
                  <button
                    onClick={() => setTypewriterOpen(true)}
                    className="rounded-xl px-4 py-2 text-sm text-[var(--wc-on-accent)]"
                    style={{ background: "var(--wc-slate)" }}
                  >
                    Reopen typewriter
                  </button>
                )}
                {saved && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-md wc-grounded-badge">
                    Saved to {mode === "existing" ? "this story" : "your practice library"}
                  </span>
                )}
              </div>

              {/* Free-write surface */}
              {writeOpen && writingMode === "free" && (
                <FreeWrite
                  key={rendered!.id + (saved ? "-saved" : "")}
                  onSave={async (content) => {
                    setError(null);
                    try {
                      await persistExercise(content, countWords(content));
                      setSaved(true);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Save failed");
                    }
                  }}
                  saved={saved}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Project picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 grid place-items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg">Which story?</h3>
              <button onClick={() => setPickerOpen(false)} className="text-zinc-400 hover:text-zinc-900 text-lg">×</button>
            </div>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setProjectId(p.id);
                      setMode("existing");
                      setEntities(null);
                      setRendered(null);
                      setWriteOpen(false);
                      setPickerOpen(false);
                      void setActiveProject(p.id);
                    }}
                    className={`w-full text-left rounded-xl border px-4 py-2.5 hover:bg-zinc-50 ${
                      p.id === projectId ? "border-[var(--wc-slate)] bg-zinc-50" : "border-zinc-200"
                    }`}
                  >
                    <span className="font-serif">{p.title}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setPickerOpen(false)}
              className="mt-3 text-xs text-zinc-500 hover:text-zinc-900"
            >
              Cancel — keep it a standalone exercise
            </button>
          </div>
        </div>
      )}

      {/* Typewriter (reuses the existing feature) */}
      {typewriterOpen && rendered && (
        <TypewriterMode
          scene={{
            id: `prompt-${rendered.id}`,
            title: "Prompted exercise",
            content: { type: "doc", content: [{ type: "paragraph" }] },
            word_count: 0,
          }}
          autoStart
          initialGoalType={goalType}
          initialGoalValue={goalValue}
          persist={(doc, wc) => {
            void persistExercise(doc, wc)
              .then(() => setSaved(true))
              .catch(() => {
                /* empty / transient — nothing to save */
              });
          }}
          promptHeader={
            <div className="font-serif">
              <Segments segs={rendered.textSegments} />
              {rendered.questionSegments && (
                <>
                  {" "}
                  <Segments segs={rendered.questionSegments} />
                </>
              )}
              {rendered.constraint && (
                <div className="mt-1 not-italic text-zinc-500 text-sm">
                  Constraint: {rendered.constraint}
                </div>
              )}
            </div>
          }
          onExit={() => setTypewriterOpen(false)}
        />
      )}
    </div>
  );
}

function PromptCard({
  rendered,
  showDeeper,
}: {
  rendered: RenderedPrompt;
  showDeeper: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Tag color="var(--wc-slate)">{FOCUS_META[rendered.focus].label}</Tag>
        <Tag color={rendered.format === "seed" ? "var(--wc-plum)" : "var(--wc-terracotta)"}>
          {rendered.format === "seed" ? "Scenario seed" : "Craft exercise"}
        </Tag>
        <Tag color="#8a8580">{rendered.depth === "deep" ? "Deep dive" : "Warm-up"}</Tag>
        {rendered.grounded && (
          <span className="text-xs px-2 py-0.5 rounded-md wc-grounded-badge font-medium">
            ✓ Grounded in your draft
          </span>
        )}
      </div>
      <p className="font-serif text-xl leading-relaxed text-[var(--wc-ink)]">
        <Segments segs={rendered.textSegments} />
      </p>
      {rendered.questionSegments && (
        <p className="font-serif text-lg leading-relaxed text-zinc-700 mt-2 italic">
          <Segments segs={rendered.questionSegments} />
        </p>
      )}
      {rendered.constraint && (
        <p className="mt-3 text-sm text-[var(--wc-terracotta)]">
          <b>Constraint:</b> {rendered.constraint}
        </p>
      )}
      {rendered.source && (
        <p className="mt-2 text-xs text-zinc-400">— {rendered.source}</p>
      )}
      {showDeeper && (
        <div className="mt-4 rounded-xl bg-[rgba(106,85,127,0.07)] border border-[rgba(106,85,127,0.2)] p-3">
          <div className="text-xs uppercase tracking-wide text-[var(--wc-plum)] mb-1">
            Go deeper
          </div>
          <p className="font-serif text-base text-zinc-700">
            <Segments segs={rendered.deeperSegments} />
          </p>
        </div>
      )}
    </div>
  );
}

function FreeWrite({
  onSave,
  saved,
}: {
  onSave: (content: unknown) => void | Promise<void>;
  saved: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Indent, ...ALL_TAG_MARKS],
    content: { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none focus:outline-none font-serif text-lg leading-relaxed min-h-[40vh]",
      },
    },
  });

  return (
    <div className="mt-5">
      <div className="border-b border-zinc-200 pb-1.5 mb-2">
        <EditorToolbar editor={editor} />
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        {editor && <TagBubbleMenu editor={editor} />}
        <EditorContent editor={editor} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => editor && onSave(editor.getJSON())}
          className="rounded-xl px-4 py-2 text-sm text-[var(--wc-on-accent)]"
          style={{ background: "var(--wc-sage)" }}
        >
          Save exercise
        </button>
        {saved && <span className="text-xs text-zinc-500">Saved.</span>}
      </div>
    </div>
  );
}

function EntityPanel({ entities }: { entities: EntityBag }) {
  const groups: [string, string[]][] = [
    ["Characters", entities.characters],
    ["Places", entities.places],
    ["Threads", entities.threads],
    ["Objects", entities.objects],
  ];
  const nonEmpty = groups.filter(([, v]) => v.length > 0);
  if (nonEmpty.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl bg-[rgba(122,158,126,0.08)] border border-[rgba(122,158,126,0.3)] p-3">
      <div className="text-xs font-medium text-[#41603f] mb-2">
        Pulled from your draft
      </div>
      <div className="space-y-1.5">
        {nonEmpty.map(([label, vals]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-1.5 text-xs">
            <span className="text-zinc-500 w-16 shrink-0">{label}</span>
            <span className="text-zinc-700">{vals.slice(0, 8).join(" · ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xs font-semibold text-[var(--wc-on-accent)] grid place-items-center w-5 h-5 rounded-md" style={{ background: "var(--wc-slate)" }}>
          {n}
        </span>
        <h2 className="font-serif text-lg text-[var(--wc-ink)]">{title}</h2>
        {hint && <span className="text-xs text-zinc-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function ModeCard({
  active,
  title,
  blurb,
  onClick,
}: {
  active: boolean;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl p-4 border transition ${
        active
          ? "border-[var(--wc-slate)] bg-[rgba(62,92,118,0.06)]"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <div className="font-serif text-base text-[var(--wc-ink)]">{title}</div>
      <div className="text-xs text-zinc-600 mt-1 leading-relaxed">{blurb}</div>
    </button>
  );
}

function DieFace({
  label,
  pips,
  seed,
  selected,
  onClick,
  image,
}: {
  label: string;
  pips?: number;
  seed?: boolean;
  selected: boolean;
  onClick: () => void;
  image?: string;
}) {
  // Carved-wood image face: the image is the die; label sits underneath.
  if (image) {
    return (
      <button
        onClick={onClick}
        aria-pressed={selected}
        className="group flex flex-col items-center gap-1 rounded-[var(--wc-r-md)] p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wc-slate)]"
      >
        <span
          className={`relative aspect-square w-full overflow-hidden rounded-[var(--wc-r-md)] transition ${
            selected
              ? "ring-2 ring-[var(--wc-slate)] ring-offset-2 ring-offset-[var(--wc-surface)]"
              : "ring-1 ring-[var(--wc-border)] group-hover:ring-[var(--wc-border-strong)]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        </span>
        <span className="text-[11px] font-medium leading-tight text-center text-[var(--wc-ink)]">
          {label}
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      data-selected={selected}
      data-seed={seed ? "true" : undefined}
      className="wc-die aspect-square p-2 grid place-items-center"
    >
      <div className="flex flex-col items-center gap-1.5">
        <PipPattern n={seed ? 0 : pips ?? 0} selected={selected} seed={seed} />
        <span
          className={`text-[11px] font-medium leading-tight text-center ${
            selected ? "text-[var(--wc-on-accent)]" : "text-[var(--wc-ink)]"
          }`}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

function PipPattern({ n, selected, seed }: { n: number; selected: boolean; seed?: boolean }) {
  const color = selected ? "rgba(255,255,255,0.92)" : "rgba(33,31,41,0.55)";
  if (seed) {
    return <span style={{ color, fontSize: 18 }}>◈</span>;
  }
  return (
    <div className="grid grid-cols-3 gap-0.5 w-6 h-6">
      {Array.from({ length: 9 }).map((_, i) => {
        const positions: Record<number, number[]> = {
          1: [4],
          2: [0, 8],
          3: [0, 4, 8],
          4: [0, 2, 6, 8],
          5: [0, 2, 4, 6, 8],
          6: [0, 2, 3, 5, 6, 8],
        };
        const on = (positions[n] ?? []).includes(i);
        return (
          <span
            key={i}
            className="rounded-full"
            style={{ background: on ? color : "transparent", width: 4, height: 4, placeSelf: "center" }}
          />
        );
      })}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm border transition ${
        active
          ? "bg-[var(--wc-slate)] text-[var(--wc-on-accent)] border-[var(--wc-slate)]"
          : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-md font-medium"
      style={{ color, background: `${color}1a` }}
    >
      {children}
    </span>
  );
}
