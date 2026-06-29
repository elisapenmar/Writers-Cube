// Per-form capability config: the single source of truth for what a project of a
// given form can DO (which tools, which Story-Bible tabs, which export presets,
// how its content is structured/edited). The side-nav and organize panel read
// from this instead of hardcoding a one-size-fits-all tool set.
//
// Feature streams plug in WITHOUT editing the shared UI: a new tool registers a
// group via `src/components/panels/registry.ts`, and gets listed here in the
// relevant form's `tools` array. If a tool id has no built-in meta and nothing
// registered (its stream hasn't shipped yet), the side-nav simply skips it — so
// this config can name tools ahead of their implementation.

import { asForm, type ProjectForm } from "@/lib/project-forms";

export type StructureModel = "hierarchical" | "flat" | "collection" | "script";
export type EditorMode = "prose" | "verse" | "script";

/** Built-in tools always available regardless of which streams have shipped. */
export type BuiltinToolId = "brainstorm" | "bible" | "organize" | "tags" | "prompts";

/** Any tool id that can appear in a form's tool row. Built-ins + stream-provided
 *  group ids (corkboard, language, research, submissions, …). */
export type ToolId = BuiltinToolId | (string & {});

/** Story-Bible sub-tabs; ids match the `OrganizeFormat`s of the bible group. */
export type BibleTab = "outline" | "characters" | "places" | "items" | "timeline";

export type FormConfig = {
  structureModel: StructureModel;
  editorMode: EditorMode;
  /** Tool buttons shown in the side-nav, in display order. */
  tools: ToolId[];
  /** Story-Bible tabs available for this form (empty array => no Story Bible). */
  bibleTabs: BibleTab[];
  /** Export preset ids offered for this form (resolved via the preset registry). */
  exportPresets: string[];
};

export const FORM_CONFIG: Record<ProjectForm, FormConfig> = {
  novel: {
    structureModel: "hierarchical",
    editorMode: "prose",
    tools: ["brainstorm", "bible", "organize", "corkboard", "tags", "prompts"],
    bibleTabs: ["outline", "characters", "places", "items", "timeline"],
    exportPresets: ["book", "kdp"],
  },
  short_story: {
    structureModel: "flat",
    editorMode: "prose",
    tools: ["brainstorm", "bible", "organize", "submissions", "tags", "prompts"],
    // Lighter bible: characters by default, no places/items.
    bibleTabs: ["outline", "characters", "timeline"],
    exportPresets: ["book", "shunn"],
  },
  poetry: {
    structureModel: "collection",
    editorMode: "verse",
    // No Story Bible; language tools instead (registered by the poetry stream).
    tools: ["brainstorm", "language", "organize", "tags", "prompts"],
    bibleTabs: [],
    exportPresets: ["book"],
  },
  essay: {
    structureModel: "flat",
    editorMode: "prose",
    // Research/source manager instead of the full bible.
    tools: ["brainstorm", "research", "organize", "tags", "prompts"],
    bibleTabs: ["outline", "timeline"],
    exportPresets: ["book"],
  },
};

/** Display metadata for the built-in tools (icon + how the button behaves). */
export const BUILTIN_TOOL_META: Record<
  BuiltinToolId,
  { label: string; icon: string; kind: "brainstorm" | "group"; group?: string; tour?: string }
> = {
  brainstorm: { label: "Brainstorm", icon: "💭", kind: "brainstorm", tour: "brainstorm" },
  bible: { label: "Story Bible", icon: "📖", kind: "group", group: "bible", tour: "bible" },
  organize: { label: "Organize", icon: "🗂️", kind: "group", group: "organize", tour: "organize" },
  tags: { label: "Tags", icon: "🏷️", kind: "group", group: "tags" },
  prompts: { label: "Prompts", icon: "🎲", kind: "group", group: "prompts", tour: "prompts" },
};

export function isBuiltinTool(id: string): id is BuiltinToolId {
  return id in BUILTIN_TOOL_META;
}

export function configFor(form: unknown): FormConfig {
  return FORM_CONFIG[asForm(form)];
}
