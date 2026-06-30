"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectTree } from "@/lib/types";
import type { UncategorizedItem } from "@/components/side-nav";
import { useOrganize } from "@/store/organize-store";
import { OrganizePanel } from "@/components/organize-panel";
import { useSyncStatusFallback } from "@/lib/sync-state";
import { MobileTabBar } from "@/components/mobile/mobile-tab-bar";
import { MobileNavDrawer } from "@/components/mobile/mobile-nav-drawer";
import { MobileEditorToolbar } from "@/components/mobile/mobile-editor-toolbar";
import { MobileTopBar } from "@/components/mobile/mobile-top-bar";

/**
 * Mobile-first chrome that wraps the writing content at phone widths. It renders
 * a top bar (project title, structure trigger, sync state), the page content,
 * the keyboard-aware editor formatting bar, the bottom tab bar, and the
 * slide-over nav drawer.
 *
 * It owns the drawer open/mode state and bridges the tab bar's "Tools" action to
 * the existing organize store (the Story Bible / AI panels), reusing that work
 * rather than reinventing it. The connectivity-based sync fallback is mounted
 * here so the sync indicator is truthful before Agent A's engine lands.
 *
 * Desktop renders the existing side-nav layout untouched; this component is only
 * mounted on the mobile branch of the writing layout.
 */
export function MobileShell({
  project,
  uncategorized,
  children,
}: {
  project: ProjectTree;
  uncategorized: UncategorizedItem[];
  children: React.ReactNode;
}) {
  const [structureOpen, setStructureOpen] = useState(false);
  useSyncStatusFallback();

  // The organize store is module-global; when the active project changes, drop
  // the previous story's Story Bible so the panel re-reads for the new project.
  // (Mirrors AppShell, which is not mounted on the mobile branch.)
  const prevProject = useRef(project.id);
  useEffect(() => {
    if (prevProject.current !== project.id) {
      prevProject.current = project.id;
      useOrganize.getState().prepareForProject();
    }
  }, [project.id]);

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col bg-[var(--wc-canvas)]">
      <MobileTopBar project={project} />

      {/* Content. Bottom padding clears the fixed tab bar / formatting bar. */}
      <main className="flex flex-1 flex-col overflow-x-hidden pb-20">{children}</main>

      <MobileEditorToolbar />

      <MobileTabBar onOpenStructure={() => setStructureOpen(true)} />

      <MobileNavDrawer
        open={structureOpen}
        mode="structure"
        project={project}
        uncategorized={uncategorized}
        onClose={() => setStructureOpen(false)}
      />

      {/* Story Bible / AI-assist panels (the "Tools" tab target). The brainstorm
          mind-map canvas is intentionally not mounted on mobile (gated off for
          v1 per the companion feature set). */}
      <OrganizePanel key={project.id} />
    </div>
  );
}
