"use client";

import { useEffect, useState } from "react";
import type { Extensions } from "@tiptap/react";
import type { SupabaseYjsProvider } from "./provider";
import type { CollabUser } from "./collab-extensions";
import type { CrdtKind } from "@/server/crdt";

/** Live co-editing is opt-in: `?yjs=1` in the URL or localStorage.yjs_enabled. */
export function yjsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("yjs") === "1") return true;
  if (params.get("yjs") === "0") return false;
  try {
    return localStorage.getItem("yjs_enabled") === "1";
  } catch {
    return false;
  }
}

const PALETTE = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#db2777"];
function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

type CollabState =
  | { mode: "off" }
  | { mode: "loading" }
  | {
      mode: "ready";
      extensions: Extensions;
      provider: SupabaseYjsProvider;
      user: CollabUser;
      /** True for the single client that should seed the doc from the blob. */
      shouldSeed: boolean;
    };

/**
 * Sets up a Yjs co-editing session for one entity (a scene or loose scene) when
 * the flag is on. Dynamically imports the Yjs bundle so nothing loads when
 * collaboration is off. Returns the collab extension set + provider once
 * connected; the editor binds to these.
 */
export function useCollab(kind: CrdtKind | null, id: string): CollabState {
  const [state, setState] = useState<CollabState>(() =>
    yjsEnabled() && kind ? { mode: "loading" } : { mode: "off" },
  );

  useEffect(() => {
    if (!yjsEnabled() || !kind) {
      setState({ mode: "off" });
      return;
    }
    setState({ mode: "loading" });
    let provider: SupabaseYjsProvider | null = null;
    let doc: import("yjs").Doc | null = null;
    let cancelled = false;

    (async () => {
      const [{ Doc }, { Awareness }, providerMod, extMod, { createClient }] = await Promise.all([
        import("yjs"),
        import("y-protocols/awareness"),
        import("./provider"),
        import("./collab-extensions"),
        import("@/lib/supabase/client"),
      ]);
      if (cancelled) return;

      doc = new Doc();
      const awareness = new Awareness(doc);
      provider = new providerMod.SupabaseYjsProvider(kind, id, doc, awareness);
      // Wait for the durable snapshot to load before the editor mounts, so the
      // seed-if-empty check sees the real state (not a transient empty doc).
      await provider.whenLoaded;
      if (cancelled) return;

      // Exactly one client seeds the doc from the blob (atomic server claim),
      // so a simultaneous cold open can't duplicate the content.
      const { claimCrdtSeed } = await import("@/server/crdt");
      const shouldSeed = await claimCrdtSeed(kind, id).catch(() => false);
      if (cancelled) return;

      // Presence identity from the signed-in user.
      let name = "Writer";
      try {
        const { data } = await createClient().auth.getUser();
        const u = data.user;
        name = (u?.user_metadata?.full_name as string) || u?.email?.split("@")[0] || "Writer";
      } catch {
        /* anonymous fallback */
      }
      if (cancelled) return;

      const user: CollabUser = { name, color: pickColor(String(doc.clientID)) };
      const extensions = extMod.buildCollabExtensions(provider, user);
      setState({ mode: "ready", extensions, provider, user, shouldSeed });
    })();

    return () => {
      cancelled = true;
      provider?.destroy();
      doc?.destroy();
    };
  }, [kind, id]);

  return state;
}

/** Convenience wrapper for the chapter-scene editors. */
export function useSceneCollab(sceneId: string): CollabState {
  return useCollab("scene", sceneId);
}
