"use client";

import type { ProjectTree } from "@/lib/types";
import type { UncategorizedItem } from "@/components/side-nav";
import { SideNav } from "@/components/side-nav";
import { AppShell } from "@/components/app-shell";
import { useMobileReady } from "@/hooks/use-is-mobile";
import { MobileShell } from "@/components/mobile/mobile-shell";

/**
 * Picks the writing chrome by form factor at runtime:
 *   - desktop / tablet: the existing fixed side-nav + AppShell, unchanged.
 *   - phone / native shell: the mobile-first shell (top bar, bottom tabs,
 *     drawer, keyboard-aware editor toolbar).
 *
 * Until the client knows its width (first paint / hydration), it renders the
 * desktop layout, which is the larger, safe default; `useMobileReady` then swaps
 * to mobile if warranted. Both branches receive the same server-fetched project
 * data, so neither path is "just a shrink" of the other (the mobile branch
 * mounts purpose-built components).
 */
export function WritingLayoutSwitch({
  project,
  uncategorized,
  children,
}: {
  project: ProjectTree;
  uncategorized: UncategorizedItem[];
  children: React.ReactNode;
}) {
  const { mobile, ready } = useMobileReady();

  if (ready && mobile) {
    return (
      <MobileShell project={project} uncategorized={uncategorized}>
        {children}
      </MobileShell>
    );
  }

  return (
    <div className="wc-workspace flex flex-1 h-screen overflow-hidden">
      <SideNav project={project} uncategorized={uncategorized} />
      <AppShell projectId={project.id}>{children}</AppShell>
    </div>
  );
}
