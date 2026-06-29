// Export-preset registry. The existing manuscript export engine
// (`src/lib/manuscript-export.ts`) owns formats, trim sizes, fonts, and
// front/back matter. A "preset" is a named bundle of those options surfaced as a
// one-click choice in the publish flow (e.g. Amazon/KDP, Shunn short-fiction
// format). Streams add a preset by dropping a file in this folder and calling
// `registerExportPreset(...)`, instead of editing the export engine inline.
//
// Each form's `form-config.ts` `exportPresets` array names which preset ids it
// offers. The `book` preset is the existing default behavior.

export type ExportPreset = {
  /** Stable id referenced from `form-config.ts` `exportPresets`. */
  id: string;
  label: string;
  description: string;
  /** Partial overrides applied on top of the user's publish settings. Typed as
   *  `Record<string, unknown>` here to avoid a hard dependency on the export
   *  engine's settings shape; the publish flow maps these onto its own type. */
  settings: Record<string, unknown>;
};

const presets = new Map<string, ExportPreset>();

export function registerExportPreset(preset: ExportPreset): void {
  presets.set(preset.id, preset);
}

export function getExportPreset(id: string): ExportPreset | undefined {
  return presets.get(id);
}

export function allExportPresets(): ExportPreset[] {
  return Array.from(presets.values());
}

// The implicit default: whatever the user already configured in publish settings.
registerExportPreset({
  id: "book",
  label: "Book",
  description: "Standard manuscript export using your publish settings.",
  settings: {},
});
