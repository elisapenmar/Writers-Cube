// Barrel that eagerly loads every export preset so its `registerExportPreset(...)`
// runs before the publish studio reads the registry. Importing `./registry` also
// registers the built-in "book" preset (declared there).
//
// Each preset stream adds ONE import line below for its preset module — this is
// the only shared file preset streams touch, and it is append-only (trivial
// merges).
//
// e.g.
//   import "@/lib/export/presets/kdp";     // Stream F — Amazon/KDP
//   import "@/lib/export/presets/shunn";   // Stream E — Shunn manuscript

import "@/lib/export/presets/registry";
import "@/lib/export/presets/shunn"; // Stream E — Shunn manuscript

export {};
