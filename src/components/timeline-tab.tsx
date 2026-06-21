"use client";

import { useEffect, useRef, useState } from "react";
import {
  getTimeline,
  saveTimeline,
  type TimelineState,
  type TimelineLane,
  type TimelineEvent,
} from "@/server/timeline";
import { SquareArrow, AiDiamond } from "@/components/icons";
import { generateTimelineFromManuscript } from "@/server/ai-generate";

const LANE_COLORS = ["#8a7a96", "#5d7384", "#8aa791", "#c07a63", "#cdab6b", "#7f8aa6"];

function uid(p: string) {
  return `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
}

export function TimelineTab() {
  const [state, setState] = useState<TimelineState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setState(await getTimeline());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
        setState({ lanes: [] });
      }
    })();
  }, []);

  function commit(next: TimelineState) {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async () => {
      try {
        await saveTimeline(next);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 500);
  }

  if (!state) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6">
        Loading timeline…
      </div>
    );
  }

  function addLane() {
    const lane: TimelineLane = {
      id: uid("lane"),
      name: `Timeline ${state!.lanes.length + 1}`,
      color: LANE_COLORS[state!.lanes.length % LANE_COLORS.length],
      events: [],
    };
    commit({ lanes: [...state!.lanes, lane] });
  }

  function patchLane(laneId: string, patch: Partial<TimelineLane>) {
    commit({
      lanes: state!.lanes.map((l) => (l.id === laneId ? { ...l, ...patch } : l)),
    });
  }

  function removeLane(laneId: string) {
    if (!confirm("Delete this timeline lane and its events?")) return;
    commit({ lanes: state!.lanes.filter((l) => l.id !== laneId) });
  }

  function addEvent(laneId: string) {
    const ev: TimelineEvent = { id: uid("ev"), title: "New event", when: "", notes: "" };
    commit({
      lanes: state!.lanes.map((l) =>
        l.id === laneId ? { ...l, events: [...l.events, ev] } : l,
      ),
    });
  }

  function patchEvent(laneId: string, evId: string, patch: Partial<TimelineEvent>) {
    commit({
      lanes: state!.lanes.map((l) =>
        l.id === laneId
          ? { ...l, events: l.events.map((e) => (e.id === evId ? { ...e, ...patch } : e)) }
          : l,
      ),
    });
  }

  function removeEvent(laneId: string, evId: string) {
    commit({
      lanes: state!.lanes.map((l) =>
        l.id === laneId ? { ...l, events: l.events.filter((e) => e.id !== evId) } : l,
      ),
    });
  }

  function moveEvent(laneId: string, evId: string, dir: -1 | 1) {
    commit({
      lanes: state!.lanes.map((l) => {
        if (l.id !== laneId) return l;
        const i = l.events.findIndex((e) => e.id === evId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= l.events.length) return l;
        const events = [...l.events];
        [events[i], events[j]] = [events[j], events[i]];
        return { ...l, events };
      }),
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--wc-border)] text-xs">
        <span className="text-[var(--wc-faint)]">
          {state.lanes.length} parallel timeline{state.lanes.length === 1 ? "" : "s"}
          {saving && " · saving…"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={async () => {
              setGenerating(true);
              setError(null);
              try {
                const next = await generateTimelineFromManuscript();
                setState(next);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Generate failed");
              } finally {
                setGenerating(false);
              }
            }}
            disabled={generating}
            className="flex items-center gap-1 rounded-md border border-[var(--wc-slate)] px-2.5 py-1 text-[var(--wc-slate)] hover:bg-[var(--wc-canvas)] disabled:opacity-40"
            title="Build a timeline from your manuscript & notes"
          >
            <AiDiamond />
            {generating ? "Reading…" : "Generate from story"}
          </button>
          <button
            onClick={addLane}
            className="rounded-md bg-[var(--wc-slate)] px-2.5 py-1 text-[var(--wc-on-accent)] hover:bg-[var(--wc-slate)]"
          >
            + Timeline
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-800 whitespace-pre-wrap">
            {error}
          </div>
        )}
        {state.lanes.length === 0 ? (
          <p className="text-sm text-[var(--wc-faint)] rounded-2xl border border-dashed border-[var(--wc-border-strong)] px-4 py-6">
            No timelines yet. Add one — then add more to track parallel threads
            (e.g. two characters, two eras) side by side.
          </p>
        ) : (
          state.lanes.map((lane) => (
            <div
              key={lane.id}
              className="rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)]"
              style={{ borderLeft: `4px solid ${lane.color}` }}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--wc-border)]">
                <input
                  value={lane.name}
                  onChange={(e) => patchLane(lane.id, { name: e.target.value })}
                  className="flex-1 bg-transparent font-serif text-base outline-none"
                  style={{ color: lane.color }}
                />
                <button
                  onClick={() => addEvent(lane.id)}
                  className="text-xs text-[var(--wc-faint)] hover:text-[var(--wc-ink)]"
                >
                  + event
                </button>
                <button
                  onClick={() => removeLane(lane.id)}
                  className="text-xs text-[var(--wc-faint)] hover:text-red-700"
                  title="Delete lane"
                >
                  ×
                </button>
              </div>

              {lane.events.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--wc-faint)]">No events yet.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {lane.events.map((ev, i) => (
                    <div
                      key={ev.id}
                      className="shrink-0 w-52 rounded-xl border border-[var(--wc-border)] bg-[var(--wc-canvas)] p-2 group"
                    >
                      <input
                        value={ev.when}
                        onChange={(e) => patchEvent(lane.id, ev.id, { when: e.target.value })}
                        placeholder="When…"
                        className="w-full bg-transparent text-[11px] uppercase tracking-wide text-[var(--wc-faint)] outline-none mb-1"
                      />
                      <input
                        value={ev.title}
                        onChange={(e) => patchEvent(lane.id, ev.id, { title: e.target.value })}
                        placeholder="Event"
                        className="w-full bg-transparent font-serif text-sm text-[var(--wc-ink)] outline-none mb-1"
                      />
                      <textarea
                        value={ev.notes}
                        onChange={(e) => patchEvent(lane.id, ev.id, { notes: e.target.value })}
                        placeholder="Notes…"
                        rows={2}
                        className="w-full bg-transparent text-xs text-[var(--wc-muted)] resize-none outline-none"
                      />
                      <div className="flex items-center justify-between mt-1 opacity-0 group-hover:opacity-100 transition">
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveEvent(lane.id, ev.id, -1)}
                            disabled={i === 0}
                            className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)] disabled:opacity-30"
                            title="Move earlier"
                          >
                            <SquareArrow dir="left" />
                          </button>
                          <button
                            onClick={() => moveEvent(lane.id, ev.id, 1)}
                            disabled={i === lane.events.length - 1}
                            className="text-[var(--wc-faint)] hover:text-[var(--wc-ink)] disabled:opacity-30"
                            title="Move later"
                          >
                            <SquareArrow dir="right" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeEvent(lane.id, ev.id)}
                          className="text-xs text-[var(--wc-faint)] hover:text-red-700"
                        >
                          delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
