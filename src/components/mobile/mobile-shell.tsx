"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectTree } from "@/lib/types";
import type { UncategorizedItem } from "@/components/side-nav";
import { useOrganize } from "@/store/organize-store";
import { OrganizePanel } from "@/components/organize-panel";
import { BrainstormSidePanel } from "@/components/brainstorm-side-panel";
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
      {/* Sticky header: the project bar plus the editor formatting bar (when an
          editor is active), so the RTE toolbar is always at the top and looks the
          same whether viewing the whole project or a single scene. */}
      <div className="sticky top-0 z-30">
        <MobileTopBar project={project} />
        <MobileEditorToolbar />
      </div>

      {/* Content. Bottom padding clears the fixed tab bar. */}
      <main className="flex flex-1 flex-col overflow-x-hidden pb-20">{children}</main>

      <MobileTabBar onOpenStructure={() => setStructureOpen(true)} />

      <MobileNavDrawer
        open={structureOpen}
        mode="structure"
        project={project}
        uncategorized={uncategorized}
        onClose={() => setStructureOpen(false)}
      />

      {/* Brainstorm (center tab) + Story Bible / Organize / Tags panels render
          full-screen on phones when their tab is tapped. */}
      <BrainstormSidePanel />
      <OrganizePanel key={project.id} />
    </div>
  );
}
