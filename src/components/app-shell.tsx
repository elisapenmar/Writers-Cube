"use client";

import { useOrganize } from "@/store/organize-store";
import { OrganizePanel } from "@/components/organize-panel";
import { BrainstormSidePanel } from "@/components/brainstorm-side-panel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pinned = useOrganize((s) => s.pinned);
  const panelWidth = useOrganize((s) => s.panelWidth);
  const bsPinned = useOrganize((s) => s.bsPinned);
  const bsWidth = useOrganize((s) => s.bsWidth);

  return (
    <>
      <main
        className="flex-1 flex flex-col bg-zinc-50"
        style={{
          marginRight: pinned ? `${panelWidth}px` : undefined,
          marginLeft: bsPinned ? `${bsWidth}px` : undefined,
        }}
      >
        {children}
      </main>
      <BrainstormSidePanel />
      <OrganizePanel />
    </>
  );
}
