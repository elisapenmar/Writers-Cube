"use client";

import { useEffect, useRef, useState } from "react";
import { useOrganize } from "@/store/organize-store";
import { OrganizePanel } from "@/components/organize-panel";
import { BrainstormSidePanel } from "@/components/brainstorm-side-panel";

export function AppShell({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: string;
}) {
  const open = useOrganize((s) => s.open);
  const panelWidth = useOrganize((s) => s.panelWidth);
  const bsOpen = useOrganize((s) => s.bsOpen);
  const bsWidth = useOrganize((s) => s.bsWidth);

  // When the active project changes, drop the previous story's notes/mind map/
  // cards so the panel re-reads from the server for the new project (the store
  // is module-global and otherwise survives the remount).
  const prevProject = useRef(projectId);
  useEffect(() => {
    if (prevProject.current !== projectId) {
      prevProject.current = projectId;
      useOrganize.getState().prepareForProject();
    }
  }, [projectId]);

  // Only reserve space for the panels on wider screens. On phones the panels
  // are full-screen overlays, so pushing the manuscript would shove it off-screen.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <>
      <main
        className="flex-1 flex flex-col bg-[var(--wc-canvas)] transition-[margin] duration-150"
        style={{
          // Reserve the panel's width whenever it's OPEN (not only when pinned),
          // so the manuscript reflows to the available area instead of being
          // covered by the floating panel.
          marginRight: wide && open ? `${panelWidth}px` : undefined,
          marginLeft: wide && bsOpen ? `${bsWidth}px` : undefined,
        }}
      >
        {children}
      </main>
      <BrainstormSidePanel />
      <OrganizePanel key={projectId} />
    </>
  );
}
