"use client";

// Group registry for the organize panel. A "group" is one tool button in the
// side-nav plus the set of tabs it opens in the right-hand panel. Built-in groups
// (organize / bible / tags / prompts) stay hardcoded in the store + organize
// panel; THIS registry is how feature streams add NEW groups (corkboard, language,
// research, submissions, …) without editing those shared files.
//
// A stream creates `src/components/panels/<feature>/index.ts` that calls
// `registerGroup(...)`, then adds a one-line import to `panels/index.ts` so the
// registration runs at app load. The tool button appears automatically for any
// form whose `form-config.ts` `tools` array names the group id.

import type { ComponentType } from "react";
import { asForm, type ProjectForm } from "@/lib/project-forms";

export type RegisteredTab = {
  /** Format id; must be unique across all groups (used as the panel `format`). */
  id: string;
  label: string;
  Component: ComponentType;
};

export type RegisteredGroup = {
  /** Group id; matches the tool id used in `form-config.ts` `tools`. */
  id: string;
  label: string;
  /** Emoji shown on the side-nav tool button. */
  icon: string;
  tabs: RegisteredTab[];
  /** Restrict to these forms; omit to allow all forms that list the group. */
  forms?: ProjectForm[];
};

const groups = new Map<string, RegisteredGroup>();

export function registerGroup(group: RegisteredGroup): void {
  groups.set(group.id, group);
}

export function getRegisteredGroup(id: string): RegisteredGroup | undefined {
  return groups.get(id);
}

export function registeredGroups(): RegisteredGroup[] {
  return Array.from(groups.values());
}

/** First tab/format id of a registered group, for the store's `openGroup`. */
export function firstRegisteredFormat(group: string): string | undefined {
  return groups.get(group)?.tabs[0]?.id;
}

/** Find the registered tab descriptor for a given format id, across all groups. */
export function findRegisteredTab(format: string): RegisteredTab | undefined {
  for (const g of groups.values()) {
    const tab = g.tabs.find((t) => t.id === format);
    if (tab) return tab;
  }
  return undefined;
}

export function isGroupAvailableForForm(id: string, form: unknown): boolean {
  const g = groups.get(id);
  if (!g) return false;
  return !g.forms || g.forms.includes(asForm(form));
}
