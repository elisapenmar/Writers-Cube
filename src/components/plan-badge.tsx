import { getPlanState } from "@/server/plan";

/**
 * Read-only plan + caps display. A self-contained server component so it can be
 * dropped into a settings or account surface without touching the nav layout.
 *
 * Reader-app rule: this shows plan state only. It contains no purchase button
 * and no link to buy. Upgrades happen on the Writer's Cube website.
 */
export async function PlanBadge() {
  const state = await getPlanState();

  if (state.isPaid) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <span className="font-medium">Paid plan.</span> Unlimited projects and AI,
        plus publish, sharing, Drive sync, and version history.
      </div>
    );
  }

  const projectsLeft = Math.max(
    0,
    state.activeProjects.limit - state.activeProjects.count,
  );

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
      <p>
        <span className="font-medium">Free plan.</span> AI assists: {state.aiUsage.used} of{" "}
        {state.aiUsage.limit} used this month ({state.aiUsage.remaining} left).
      </p>
      <p className="mt-1">
        Projects: {state.activeProjects.count} of {state.activeProjects.limit} active
        ({projectsLeft} left).
      </p>
      <p className="mt-1 text-xs text-stone-500">
        Upgrade on the Writer&apos;s Cube website for unlimited projects and AI.
      </p>
    </div>
  );
}
