"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import type { ProjectTree } from "@/lib/types";
import type { UncategorizedItem } from "@/components/side-nav";
import { termsFor } from "@/lib/project-forms";
import { createChapter, createScene, createPieceInProject, signOut } from "@/server/scenes";
import { createLooseScene } from "@/server/loose";
import { CubeMark } from "@/components/icons";

export type DrawerMode = "structure" | "more";

/**
 * Slide-over drawer for mobile navigation. Two modes:
 *
 *   "structure": the project tree (chapters / scenes / loose items) as a flat,
 *      link-based list with large tap targets. No `@dnd-kit` drag handles, no
 *      drag-to-file gestures (those are pointer-oriented and gated off on mobile
 *      for v1); reordering stays a desktop affordance. Tapping any item
 *      navigates and closes the drawer.
 *
 *   "more": secondary actions (dashboard, replay tour, sign out). Publish studio
 *      and manuscript-export UI are intentionally absent on mobile (companion
 *      feature set).
 *
 * It is a left-anchored overlay (full-height) with a scrim, so it never reserves
 * layout width the way the desktop side-nav does.
 */
export function MobileNavDrawer({
  open,
  mode,
  project,
  uncategorized,
  onClose,
}: {
  open: boolean;
  mode: DrawerMode;
  project: ProjectTree;
  uncategorized: UncategorizedItem[];
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <button
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <div
        className="absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col bg-[var(--wc-surface)] shadow-[var(--wc-shadow-md)]"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--wc-border)] px-4 py-3">
          <span className="flex items-center gap-2 font-serif text-lg text-[var(--wc-ink)]">
            <CubeMark className="text-[var(--wc-slate)]" />
            {mode === "structure" ? project.title : "Menu"}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--wc-faint)] active:bg-[var(--wc-paper)]"
          >
            <CloseIcon />
          </button>
        </div>

        {mode === "structure" ? (
          <StructureList project={project} uncategorized={uncategorized} onNavigate={onClose} />
        ) : (
          <MoreMenu onNavigate={onClose} />
        )}
      </div>
    </div>
  );
}

function StructureList({
  project,
  uncategorized,
  onNavigate,
}: {
  project: ProjectTree;
  uncategorized: UncategorizedItem[];
  onNavigate: () => void;
}) {
  const params = useParams<{ sceneId?: string }>();
  const terms = termsFor(project.form);
  const [pending, start] = useTransition();

  function addGroup() {
    start(async () => {
      if (terms.flat) await createPieceInProject(project.id);
      else await createChapter(project.id);
      onNavigate();
    });
  }
  function addScene(chapterId: string) {
    start(async () => {
      await createScene(chapterId);
      onNavigate();
    });
  }
  function addLoose() {
    start(async () => {
      await createLooseScene(project.id);
    });
  }

  const flatScenes = project.chapters.flatMap((c) => c.scenes);

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      {terms.flat ? (
        <ul className="space-y-0.5">
          {flatScenes.length === 0 ? (
            <Empty>No {terms.pieceSingular.toLowerCase()}s yet.</Empty>
          ) : (
            flatScenes.map((s) => (
              <SceneRow key={s.id} href={`/app/scene/${s.id}`} title={s.title} active={params.sceneId === s.id} onClick={onNavigate} />
            ))
          )}
        </ul>
      ) : project.chapters.length === 0 ? (
        <Empty>No {terms.groupPlural.toLowerCase()} yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {project.chapters.map((chapter) => (
            <li key={chapter.id}>
              <div className="flex items-center justify-between px-2 py-1">
                <Link
                  href={`/app/chapter/${chapter.id}`}
                  onClick={onNavigate}
                  className="flex-1 truncate text-sm font-medium text-[var(--wc-muted)]"
                >
                  {chapter.title}
                </Link>
                <button
                  onClick={() => addScene(chapter.id)}
                  disabled={pending}
                  className="ml-2 rounded px-2 py-1 text-xs text-[var(--wc-faint)] active:bg-[var(--wc-paper)] disabled:opacity-50"
                >
                  + scene
                </button>
              </div>
              <ul className="ml-2 border-l border-[var(--wc-border)] pl-2">
                {chapter.scenes.map((scene) => (
                  <SceneRow key={scene.id} href={`/app/scene/${scene.id}`} title={scene.title} active={params.sceneId === scene.id} onClick={onNavigate} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] uppercase tracking-widest text-[var(--wc-faint)]">Uncategorized</span>
          <button onClick={addLoose} disabled={pending} className="text-xs text-[var(--wc-faint)] active:text-[var(--wc-ink)] disabled:opacity-50">
            + add
          </button>
        </div>
        {uncategorized.length === 0 ? (
          <Empty>Loose items land here.</Empty>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {uncategorized.map((u) => (
              <SceneRow
                key={`${u.kind}-${u.id}`}
                href={u.kind === "loose" ? `/app/loose/${u.id}` : `/app/exercises/${u.id}`}
                title={u.title}
                onClick={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={addGroup}
        disabled={pending}
        className="mt-5 w-full rounded-[var(--wc-r-md)] bg-[var(--wc-slate)] px-3 py-3 text-sm text-[var(--wc-on-accent)] active:opacity-90 disabled:opacity-50"
      >
        + New {(terms.flat ? terms.pieceSingular : terms.groupSingular).toLowerCase()}
      </button>
    </div>
  );
}

function MoreMenu({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      <ul className="space-y-0.5">
        <li>
          <Link href="/app" onClick={onNavigate} className="block rounded-lg px-3 py-3 text-sm text-[var(--wc-ink)] active:bg-[var(--wc-paper)]">
            Dashboard
          </Link>
        </li>
        <li>
          <Link href="/app/projects" onClick={onNavigate} className="block rounded-lg px-3 py-3 text-sm text-[var(--wc-ink)] active:bg-[var(--wc-paper)]">
            All projects
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("wc:start-tour"));
              onNavigate();
            }}
            className="block w-full rounded-lg px-3 py-3 text-left text-sm text-[var(--wc-ink)] active:bg-[var(--wc-paper)]"
          >
            Replay studio tour
          </button>
        </li>
      </ul>
      <form action={signOut} className="mt-3 border-t border-[var(--wc-border)] pt-3">
        <button type="submit" className="block w-full rounded-lg px-3 py-3 text-left text-sm text-[var(--wc-muted)] active:bg-[var(--wc-paper)]">
          Sign out
        </button>
      </form>
      <p className="px-3 pt-4 text-[11px] leading-relaxed text-[var(--wc-faint)]">
        Publishing and manuscript export live on the desktop app. Your work syncs across devices.
      </p>
    </div>
  );
}

function SceneRow({
  href,
  title,
  active = false,
  onClick,
}: {
  href: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={`block truncate rounded-lg px-3 py-2.5 text-sm ${
          active ? "bg-[var(--wc-paper)] text-[var(--wc-ink)]" : "text-[var(--wc-muted)] active:bg-[var(--wc-canvas)]"
        }`}
      >
        {title}
      </Link>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-3 text-sm text-[var(--wc-faint)]">{children}</p>;
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
