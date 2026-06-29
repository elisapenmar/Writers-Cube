"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { reconcileActiveProject } from "@/server/projects";

/**
 * Keeps the active-project cookie in step with the project whose content is on
 * screen. Scene/chapter pages address content by id and don't touch the cookie,
 * so without this the Story Bible / Organize panel (which read the cookie) can
 * show a different story. When they disagree we set the cookie and refresh so the
 * layout + side panel re-resolve to the right project.
 */
export function ActiveProjectSync({
  projectId,
  activeId,
}: {
  projectId: string;
  activeId: string | null;
}) {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!projectId || projectId === activeId || handled.current) return;
    handled.current = true;
    void (async () => {
      const changed = await reconcileActiveProject(projectId);
      if (changed) router.refresh();
    })();
  }, [projectId, activeId, router]);

  return null;
}
