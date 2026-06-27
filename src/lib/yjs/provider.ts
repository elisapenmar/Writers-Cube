import * as Y from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { loadSceneCrdt, saveSceneCrdt } from "@/server/crdt";

function toB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function fromB64(b: string): Uint8Array {
  const s = atob(b);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

const PERSIST_DEBOUNCE_MS = 1500;

/**
 * Syncs one Y.Doc for a scene over a Supabase Realtime broadcast channel, with
 * a durable snapshot in `scene_crdt` so a lone client still loads the latest
 * state. No dedicated server — Realtime is the transport.
 *
 * - Only INCREMENTAL updates go over the wire; remote applies are tagged with a
 *   private origin so they are never re-broadcast (no echo loop).
 * - A state-vector handshake on join lets a late joiner receive edits not yet
 *   snapshotted (each side asks for, and answers, a diff).
 * - Awareness (presence/cursors) rides the same channel.
 */
export class SupabaseYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  synced = false;
  /** Resolves once the durable snapshot (if any) has been applied. */
  readonly whenLoaded: Promise<void>;

  private channel: RealtimeChannel;
  private readonly remote = {}; // private origin marker for remote-applied updates
  private readonly sceneId: string;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private resolveLoaded!: () => void;

  constructor(sceneId: string, doc: Y.Doc, awareness: Awareness) {
    this.sceneId = sceneId;
    this.doc = doc;
    this.awareness = awareness;
    this.whenLoaded = new Promise((resolve) => (this.resolveLoaded = resolve));

    const supabase = createClient();
    this.channel = supabase.channel(`crdt:${sceneId}`, {
      config: { broadcast: { self: false } },
    });

    // Attach listeners BEFORE subscribing so no early message is missed.
    this.channel
      .on("broadcast", { event: "update" }, ({ payload }) => {
        Y.applyUpdate(this.doc, fromB64(payload.d), this.remote);
      })
      .on("broadcast", { event: "sync1" }, ({ payload }) => {
        // A peer asked for our state since their vector — reply with a diff.
        const diff = Y.encodeStateAsUpdate(this.doc, fromB64(payload.sv));
        void this.channel.send({ type: "broadcast", event: "sync2", payload: { d: toB64(diff) } });
      })
      .on("broadcast", { event: "sync2" }, ({ payload }) => {
        Y.applyUpdate(this.doc, fromB64(payload.d), this.remote);
        this.synced = true;
      })
      .on("broadcast", { event: "awareness" }, ({ payload }) => {
        applyAwarenessUpdate(this.awareness, fromB64(payload.u), this);
      });

    this.doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);

    // Load the durable snapshot first, then go live.
    void this.init();
  }

  private async init() {
    try {
      const state = await loadSceneCrdt(this.sceneId);
      if (state && !this.destroyed) Y.applyUpdate(this.doc, fromB64(state), this.remote);
    } catch {
      /* fall back to the JSONB blob the editor already loaded */
    } finally {
      this.resolveLoaded();
    }
    if (this.destroyed) return;
    this.channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // Ask peers for anything newer than our state, and announce presence.
      void this.channel.send({
        type: "broadcast",
        event: "sync1",
        payload: { sv: toB64(Y.encodeStateVector(this.doc)) },
      });
      this.broadcastAwareness([this.doc.clientID]);
    });
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this.remote) return; // never re-broadcast a remote edit
    void this.channel.send({ type: "broadcast", event: "update", payload: { d: toB64(update) } });
    this.schedulePersist();
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
  ) => {
    this.broadcastAwareness([...added, ...updated, ...removed]);
  };

  private broadcastAwareness(clients: number[]) {
    void this.channel.send({
      type: "broadcast",
      event: "awareness",
      payload: { u: toB64(encodeAwarenessUpdate(this.awareness, clients)) },
    });
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.persist(), PERSIST_DEBOUNCE_MS);
  }

  private async persist() {
    try {
      await saveSceneCrdt(this.sceneId, toB64(Y.encodeStateAsUpdate(this.doc)));
    } catch {
      /* snapshot is best-effort; the live channel + JSONB blob still hold state */
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    void this.persist(); // final snapshot
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    removeAwarenessStates(this.awareness, [this.doc.clientID], "destroy");
    void this.channel.unsubscribe();
  }
}
