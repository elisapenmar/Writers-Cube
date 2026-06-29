/**
 * Plan caps, types, and labels for the monetization plumbing (Phase 5).
 *
 * Kept out of the "use server" module (src/server/plan.ts) because a server
 * actions file may only export async functions. Importing these constants is
 * safe from both server and client code.
 */

export type Plan = "free" | "paid";

/**
 * Free-tier caps live here so every gate reads the same numbers and they are
 * easy to tune in one place.
 * - MAX_ACTIVE_PROJECTS: how many non-archived projects a free user may keep.
 * - MONTHLY_AI_ASSISTS: AI-assist calls a free user may run per calendar month.
 *   This protects margin because the Claude API bills per token.
 * Paid plans are uncapped (represented as Infinity at the gate).
 */
export const FREE_TIER = {
  MAX_ACTIVE_PROJECTS: 3,
  MONTHLY_AI_ASSISTS: 25,
} as const;

/** What a paid subscription unlocks (cross-device, not phone-specific). */
export type PaidFeature =
  | "unlimited_projects"
  | "full_ai"
  | "publish_export"
  | "craft_library"
  | "sharing"
  | "drive_sync"
  | "version_history";

export const FEATURE_LABELS: Record<PaidFeature, string> = {
  unlimited_projects: "Unlimited projects",
  full_ai: "Unlimited AI assists",
  publish_export: "Publish and export",
  craft_library: "The craft library",
  sharing: "Sharing and collaboration",
  drive_sync: "Google Drive sync",
  version_history: "Version history",
};

export type PlanState = {
  plan: Plan;
  isPaid: boolean;
  caps: {
    maxActiveProjects: number; // Infinity on paid
    monthlyAiAssists: number; // Infinity on paid
  };
  aiUsage: {
    used: number;
    limit: number; // Infinity on paid
    remaining: number; // Infinity on paid
  };
  activeProjects: {
    count: number;
    limit: number; // Infinity on paid
  };
};

export type AiAllowance = {
  allowed: boolean;
  used: number;
  limit: number; // Infinity on paid
  remaining: number; // Infinity on paid
};
