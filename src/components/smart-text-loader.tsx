"use client";

import { useEffect } from "react";
import { listStoryElements } from "@/server/refs";
import {
  setStoryElements,
  setElementOpenHandler,
  type StoryElement,
} from "@/lib/story-elements";
import { useOrganize } from "@/store/organize-store";

/**
 * Feeds the Smart Text registry for the active project and routes ⌘/Ctrl-clicks
 * on a recognized name to the right Story Bible card. Mounted once in the writing
 * layout. Refreshes when the Story Bible signals a change (wc:story-elements-changed)
 * and when the tab/window regains focus.
 */
export function SmartTextLoader() {
  useEffect(() => {
    setElementOpenHandler((el: StoryElement) => {
      const s = useOrganize.getState();
      if (el.kind === "place") s.openPlace(el.id);
      else if (el.kind === "item") s.openItem(el.id);
      else s.openCharacter(el.id);
    });

    let alive = true;
    const refresh = async () => {
      try {
        const els = await listStoryElements();
        if (alive) setStoryElements(els);
      } catch {
        /* keep the last known set on a transient failure */
      }
    };
    void refresh();

    const onChanged = () => void refresh();
    window.addEventListener("wc:story-elements-changed", onChanged);
    window.addEventListener("focus", onChanged);
    return () => {
      alive = false;
      window.removeEventListener("wc:story-elements-changed", onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, []);

  return null;
}
