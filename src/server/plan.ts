"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  FREE_TIER,
  FEATURE_LABELS,
  type Plan,
  type PaidFeature,
  type PlanState,
  type AiAllowance,
} from "@/server/plan-constants";

/**
 * Monetization plumbing (Phase 5). Account-level plan state plus the free-tier
 * caps and the requirePlan() gate that enforces them.
 *
 * Reader-app model: billing happens on the website via Stripe. This module adds
 * the plan-state read + enforcement plumbing only. There is no checkout here and
 * no purchase UI anywhere in the app. Caps and types live in plan-constants.ts
 * because a "use server" file may only export async functions.
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** The first day of the current month (UTC), used as the AI meter period key. */
function currentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Read the signed-in user's plan, defaulting to 'free' when no row exists. */
export async function getPlan(): Promise<Plan> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("account_plans")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.plan as Plan | undefined) === "paid" ? "paid" : "free";
}

/**
 * One read that the UI (and any gate) can use to show plan + caps + live usage.
 * Reuses the same auth/user helper as the rest of the server actions.
 */
export async function getPlanState(): Promise<PlanState> {
  const { supabase, user } = await requireUser();

  const { data: planRow } = await supabase
    .from("account_plans")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();
  const plan: Plan = (planRow?.plan as Plan | undefined) === "paid" ? "paid" : "free";
  const isPaid = plan === "paid";

  const { data: meterRow } = await supabase
    .from("ai_usage_meter")
    .select("used")
    .eq("user_id", user.id)
    .eq("period", currentPeriod())
    .maybeSingle();
  const used = (meterRow?.used as number | undefined) ?? 0;

  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("archived_at", null);
  const activeCount = projectCount ?? 0;

  const aiLimit = isPaid ? Infinity : FREE_TIER.MONTHLY_AI_ASSISTS;
  const projectLimit = isPaid ? Infinity : FREE_TIER.MAX_ACTIVE_PROJECTS;

  return {
    plan,
    isPaid,
    caps: {
      maxActiveProjects: projectLimit,
      monthlyAiAssists: aiLimit,
    },
    aiUsage: {
      used,
      limit: aiLimit,
      remaining: isPaid ? Infinity : Math.max(0, aiLimit - used),
    },
    activeProjects: {
      count: activeCount,
      limit: projectLimit,
    },
  };
}

/**
 * Gate a server action (or, via a thin check, the UI) on having a paid plan.
 * Throws when the caller is on the free tier, so a free user hitting a paid-only
 * entry point gets a clear, catchable error. The optional `feature` only shapes
 * the message; the check is plan-level (one cross-device subscription).
 *
 * Wire this at paid-only server entry points (publish/export, craft library,
 * sharing, Drive sync, version history). Those callers live in files owned by
 * other streams; this is the shared helper they call.
 */
export async function requirePlan(feature?: PaidFeature): Promise<void> {
  const plan = await getPlan();
  if (plan !== "paid") {
    const label = feature ? FEATURE_LABELS[feature] : "This feature";
    throw new Error(
      `${label} is part of the paid plan. You can upgrade on the Writer's Cube website.`,
    );
  }
}

/**
 * Enforce the active-project cap before creating a project. Paid plans pass
 * through. Free plans throw once they are at the limit. Call this from the
 * project-creation server entry point.
 */
export async function requireProjectCapacity(): Promise<void> {
  const { supabase, user } = await requireUser();
  const plan = await getPlan();
  if (plan === "paid") return;

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("archived_at", null);
  if ((count ?? 0) >= FREE_TIER.MAX_ACTIVE_PROJECTS) {
    throw new Error(
      `The free plan keeps up to ${FREE_TIER.MAX_ACTIVE_PROJECTS} active projects. Archive one, or upgrade on the Writer's Cube website for unlimited projects.`,
    );
  }
}

/**
 * Check the monthly AI-assist allowance without consuming it. Use this to decide
 * whether to soft-warn in the UI before a call.
 */
export async function checkAiAllowance(): Promise<AiAllowance> {
  const { supabase, user } = await requireUser();
  const plan = await getPlan();
  if (plan === "paid") {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
  }
  const { data } = await supabase
    .from("ai_usage_meter")
    .select("used")
    .eq("user_id", user.id)
    .eq("period", currentPeriod())
    .maybeSingle();
  const used = (data?.used as number | undefined) ?? 0;
  const limit = FREE_TIER.MONTHLY_AI_ASSISTS;
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Meter one AI-assist call against the monthly allowance. Paid plans are not
 * metered. Free plans: throws when already at the cap (block), otherwise records
 * the call atomically and returns the new allowance snapshot.
 *
 * Call this once per AI-assist generation, before spending Claude tokens, so a
 * capped user is blocked rather than billed.
 */
export async function consumeAiAllowance(): Promise<AiAllowance> {
  const { supabase, user } = await requireUser();
  const plan = await getPlan();
  if (plan === "paid") {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity };
  }

  const limit = FREE_TIER.MONTHLY_AI_ASSISTS;

  // Read current usage first so we can block before incrementing.
  const { data: before } = await supabase
    .from("ai_usage_meter")
    .select("used")
    .eq("user_id", user.id)
    .eq("period", currentPeriod())
    .maybeSingle();
  const usedBefore = (before?.used as number | undefined) ?? 0;
  if (usedBefore >= limit) {
    throw new Error(
      `You have used all ${limit} AI assists for this month on the free plan. Upgrade on the Writer's Cube website for unlimited AI.`,
    );
  }

  // Increment atomically via the SECURITY DEFINER function (handles the
  // create-or-bump in one round trip and is concurrency-safe).
  const { data: usedAfter, error } = await supabase.rpc("increment_ai_usage", {
    p_period: currentPeriod(),
  });
  if (error) throw new Error(error.message);

  const used = (usedAfter as number | null) ?? usedBefore + 1;
  return {
    allowed: used <= limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
