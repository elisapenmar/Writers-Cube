"use client";

// Eagerly imported so every feature stream's `registerGroup(...)` runs at app
// load (before the side-nav decides which tool buttons to show). Each Wave-1/2
// stream adds ONE import line here for its panel module — this is the only shared
// file panel streams touch, and it is append-only (trivial merges).
//
// e.g.
//   import "@/components/panels/corkboard";    // Stream A
//   import "@/components/panels/research";      // Stream D
//   import "@/components/panels/submissions";   // Stream E
//   import "@/components/panels/language";       // Stream C

import "@/components/panels/corkboard"; // Stream A
import "@/components/panels/research"; // Stream D
import "@/components/panels/submissions"; // Stream E, submissions tracker
import "@/components/panels/poetry"; // Stream C, poetry language sidebar

export {};
