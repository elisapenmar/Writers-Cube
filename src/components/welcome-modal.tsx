"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CubeMark, AiDiamond } from "@/components/icons";
import { createProject } from "@/server/projects";

const SEEN_KEY = "wc_onboarded_v1";

type Step = { title: string; body: React.ReactNode };

const STEPS: Step[] = [
  {
    title: "Welcome to Writer's Cube",
    body: (
      <p>
        A calm studio for writing your novel, draft in focus, keep your story world
        organized, and call on an AI thought-partner only when you want one. Here&apos;s
        the quick tour.
      </p>
    ),
  },
  {
    title: "Your studio",
    body: (
      <ul className="space-y-3 text-left">
        <Feature icon="✍️" name="Manuscript">
          Write scene-by-scene or as one flowing scroll. Tag passages, split or merge
          scenes, and every scene keeps its own version history.
        </Feature>
        <Feature icon="📖" name="Story Bible" ai>
          Characters, an outline, and a timeline, each can be generated
          from your manuscript or brainstorm.
        </Feature>
        <Feature icon="💭" name="Brainstorm" ai>
          Talk it out with an AI thought-partner, then turn the conversation into notes
          or a map.
        </Feature>
        <Feature icon="🎲" name="Prompts" ai>
          Warm-ups and story-grounded prompts for when you&apos;re stuck.
        </Feature>
        <Feature icon="✦" name="Publish">
          When you&apos;re ready, export to EPUB, a print-ready PDF, or Word.
        </Feature>
      </ul>
    ),
  },
  {
    title: "Start your first project",
    body: (
      <p>
        Create a fresh project, or import a draft you already have (from your computer or
        Google Drive) using the buttons on the dashboard. You can always come back to this
        tour from <span className="font-medium">“How it works.”</span>
      </p>
    ),
  },
];

function Feature({
  icon,
  name,
  ai,
  children,
}: {
  icon: string;
  name: string;
  ai?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="text-lg leading-none mt-0.5">{icon}</span>
      <span className="text-sm text-[var(--wc-muted)]">
        <span className="font-medium text-[var(--wc-ink)] inline-flex items-center gap-1">
          {name}
          {ai && <AiDiamond className="text-[var(--wc-slate)]" size={12} />}
        </span>{" "}
       , {children}
      </span>
    </li>
  );
}

export function WelcomeModal({ hasProjects }: { hasProjects: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();
  const [creating, startCreate] = useTransition();

  // Auto-open for a first-time user (no projects yet, never dismissed).
  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      // Post-hydration localStorage check: cannot run during SSR render, so a
      // lazy initializer would not work here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!seen && !hasProjects) setOpen(true);
    } catch {
      /* localStorage unavailable */
    }
  }, [hasProjects]);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    setStep(0);
  }

  function startTour() {
    dismiss();
    // Let the modal unmount, then launch the dashboard spotlight tour.
    setTimeout(() => window.dispatchEvent(new Event("wc:start-dashboard-tour")), 60);
  }

  function createFirstProject() {
    startCreate(async () => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      await createProject("My First Novel");
      router.push("/app/manuscript");
    });
  }

  const isLast = step === STEPS.length - 1;

  return (
    <>
      <button
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        className="text-xs text-[var(--wc-slate)] hover:underline"
      >
        ✦ How it works
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[var(--wc-r-xl)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-6 shadow-[var(--wc-shadow-md)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--wc-slate)]">
                <CubeMark size={18} />
                Writer&apos;s Cube
              </div>
              <button
                onClick={dismiss}
                className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)] text-lg leading-none"
                title="Close"
              >
                ×
              </button>
            </div>

            <h2 className="font-serif text-2xl text-[var(--wc-ink)]">{STEPS[step].title}</h2>
            <div className="mt-3 text-sm text-[var(--wc-muted)] leading-relaxed">
              {STEPS[step].body}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        i === step ? "bg-[var(--wc-slate)]" : "bg-[var(--wc-border-strong)]"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={startTour}
                  className="text-xs text-[var(--wc-slate)] hover:underline"
                >
                  Take a tour
                </button>
              </div>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
                  >
                    Back
                  </button>
                )}
                {!isLast ? (
                  <>
                    <button
                      onClick={dismiss}
                      className="rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      className="rounded-[var(--wc-r-md)] px-4 py-1.5 text-sm text-[var(--wc-on-accent)]"
                      style={{ background: "var(--wc-slate)" }}
                    >
                      Next
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={dismiss}
                      className="rounded-[var(--wc-r-md)] px-3 py-1.5 text-sm text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
                    >
                      I&apos;ll explore
                    </button>
                    <button
                      onClick={createFirstProject}
                      disabled={creating}
                      className="rounded-[var(--wc-r-md)] px-4 py-1.5 text-sm text-[var(--wc-on-accent)] disabled:opacity-50"
                      style={{ background: "var(--wc-clay)" }}
                    >
                      {creating ? "Creating…" : "Create my first project"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
