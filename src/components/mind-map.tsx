"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type NodePositionChange,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MindMapNode } from "@/server/brainstorm";
import { FloatingEdge } from "@/components/mind-map-floating-edge";
import {
  saveMindMap,
  type SavedPosition,
  type SavedMindMap,
} from "@/server/mindmap";

const edgeTypes = { floating: FloatingEdge };

/* ---------- Node component ---------- */

type EditableNodeData = {
  label: string;
  level: 0 | 1 | 2;
  onChange: (id: string, next: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
};

function EditableBubble({ id, data }: NodeProps<Node<EditableNodeData>>) {
  const { label, level, onChange, onAddChild, onDelete } = data;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(label);

  useEffect(() => setText(label), [label]);

  const styleByLevel: Record<0 | 1 | 2, string> = {
    0: "bg-[var(--wc-slate)] text-zinc-50 border-[var(--wc-slate)] font-serif text-base px-5 py-3 rounded-2xl shadow-lg",
    1: "bg-[var(--wc-surface)] text-[var(--wc-ink)] border-[var(--wc-border-strong)] font-serif text-sm px-4 py-2.5 rounded-2xl shadow",
    2: "bg-[var(--wc-canvas)] text-[var(--wc-muted)] border-[var(--wc-border)] font-serif text-xs px-3 py-2 rounded-2xl",
  };

  return (
    <div className="group relative">
      <div
        className={`border ${styleByLevel[level]} max-w-[14rem] text-center cursor-text break-words`}
        onDoubleClick={() => setEditing(true)}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{ opacity: 0, top: "50%", left: "50%", pointerEvents: "none" }}
        />
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              setEditing(false);
              onChange(id, text.trim() || label);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              } else if (e.key === "Escape") {
                setText(label);
                setEditing(false);
              }
            }}
            rows={Math.max(1, Math.ceil(text.length / 22))}
            className="w-full bg-transparent border-0 outline-none text-center resize-none font-serif leading-tight"
            style={{ color: "inherit" }}
          />
        ) : (
          <div className="leading-snug">{label}</div>
        )}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ opacity: 0, top: "50%", left: "50%", pointerEvents: "none" }}
        />
      </div>

      {/* Hover toolbar — Add child + Delete */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(id);
          }}
          title="Add child node"
          className="w-7 h-7 rounded-full bg-[var(--wc-surface)] border border-[var(--wc-border-strong)] text-[var(--wc-muted)] hover:bg-[var(--wc-slate)] hover:text-white shadow text-sm leading-none flex items-center justify-center"
        >
          +
        </button>
        {level !== 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            title="Delete node + its children"
            className="w-7 h-7 rounded-full bg-[var(--wc-surface)] border border-[var(--wc-border-strong)] text-[var(--wc-faint)] hover:bg-red-600 hover:text-white shadow text-sm leading-none flex items-center justify-center"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { editable: EditableBubble };

/* ---------- Layout ---------- */

type LayoutResult = {
  x: number;
  y: number;
  level: 0 | 1 | 2;
};

function layoutRadial(nodes: MindMapNode[]): LayoutResult[] {
  if (nodes.length === 0) return [];

  const idSet = new Set(nodes.map((n) => n.id));
  const root = nodes.find((n) => !n.parent) ?? nodes[0];

  const childrenOf = new Map<string, MindMapNode[]>();
  for (const n of nodes) {
    if (n.id === root.id) continue;
    const parentId = n.parent && idSet.has(n.parent) ? n.parent : root.id;
    const list = childrenOf.get(parentId) ?? [];
    list.push(n);
    childrenOf.set(parentId, list);
  }

  const leafCache = new Map<string, number>();
  function leaves(id: string): number {
    if (leafCache.has(id)) return leafCache.get(id)!;
    const kids = childrenOf.get(id) ?? [];
    const n = kids.length === 0 ? 1 : kids.reduce((s, k) => s + leaves(k.id), 0);
    leafCache.set(id, n);
    return n;
  }

  function distanceAt(depth: number): number {
    if (depth === 1) return 280;
    if (depth === 2) return 210;
    return 170;
  }

  const positions = new Map<string, LayoutResult>();
  positions.set(root.id, { x: 0, y: 0, level: 0 });

  function place(
    parentId: string,
    parentX: number,
    parentY: number,
    parentAngle: number,
    parentWedge: number,
    depth: number,
  ) {
    const kids = childrenOf.get(parentId) ?? [];
    if (kids.length === 0) return;
    const totalLeaves = kids.reduce((s, k) => s + leaves(k.id), 0);
    const dist = distanceAt(depth);
    let cursor = parentAngle - parentWedge / 2;
    for (const kid of kids) {
      const kidLeaves = leaves(kid.id);
      const kidWedge = (parentWedge * kidLeaves) / totalLeaves;
      const kidAngle = cursor + kidWedge / 2;
      const x = parentX + dist * Math.cos(kidAngle);
      const y = parentY + dist * Math.sin(kidAngle);
      positions.set(kid.id, { x, y, level: depth >= 2 ? 2 : 1 });
      place(kid.id, x, y, kidAngle, kidWedge * 0.85, depth + 1);
      cursor += kidWedge;
    }
  }

  place(root.id, 0, 0, -Math.PI / 2, 2 * Math.PI, 1);

  return nodes.map(
    (n) => positions.get(n.id) ?? { x: 0, y: 0, level: 1 as const },
  );
}

/**
 * Combine auto-layout with manually-saved positions, then iteratively push
 * overlapping nodes apart. Manually positioned nodes are pinned.
 */
function resolvePositions(
  nodes: MindMapNode[],
  savedPositions: Record<string, SavedPosition>,
): { x: number; y: number; level: 0 | 1 | 2; pinned: boolean }[] {
  const auto = layoutRadial(nodes);
  const merged = nodes.map((n, i) => {
    const saved = savedPositions[n.id];
    if (saved) {
      return { x: saved.x, y: saved.y, level: auto[i].level, pinned: true };
    }
    return { ...auto[i], pinned: false };
  });

  // Iterative collision relief — push unpinned nodes apart from any neighbor.
  const minDist = 230;
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const a = merged[i];
        const b = merged[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < minDist) {
          const overlap = minDist - d;
          const ux = dx / d;
          const uy = dy / d;
          const aMovable = !a.pinned && a.level !== 0;
          const bMovable = !b.pinned && b.level !== 0;
          if (aMovable && bMovable) {
            a.x -= (ux * overlap) / 2;
            a.y -= (uy * overlap) / 2;
            b.x += (ux * overlap) / 2;
            b.y += (uy * overlap) / 2;
            moved = true;
          } else if (aMovable) {
            a.x -= ux * overlap;
            a.y -= uy * overlap;
            moved = true;
          } else if (bMovable) {
            b.x += ux * overlap;
            b.y += uy * overlap;
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }

  return merged;
}

/* ---------- Component ---------- */

export function MindMap({
  rawNodes,
  initialPositions,
}: {
  rawNodes: MindMapNode[];
  initialPositions: Record<string, SavedPosition>;
}) {
  const [nodesData, setNodesData] = useState<MindMapNode[]>(rawNodes);
  const [positionMap, setPositionMap] =
    useState<Record<string, SavedPosition>>(initialPositions);

  // If the AI generates a new map (rawNodes changes), reset.
  useEffect(() => {
    setNodesData(rawNodes);
    setPositionMap(initialPositions);
  }, [rawNodes, initialPositions]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleSave(state: SavedMindMap, delay = 500) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveMindMap(state).catch(() => {});
    }, delay);
  }

  const handlers = useMemo(
    () => ({
      onLabelChange: (id: string, next: string) => {
        setNodesData((prev) => {
          const updated = prev.map((n) =>
            n.id === id ? { ...n, label: next } : n,
          );
          scheduleSave({ nodes: updated, positions: positionMap });
          return updated;
        });
      },
      onAddChild: (parentId: string) => {
        const newId = `n-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const newNode: MindMapNode = {
          id: newId,
          label: "New idea",
          parent: parentId,
        };
        // Place the new node ~210px away from parent in a sensible direction.
        const parentPos = positionMap[parentId] ?? {
          x: 0,
          y: 0,
        };
        const angle =
          Math.atan2(parentPos.y, parentPos.x) ||
          -Math.PI / 2 + Math.random() * Math.PI;
        const newPos: SavedPosition = {
          x: parentPos.x + 210 * Math.cos(angle),
          y: parentPos.y + 210 * Math.sin(angle),
        };
        const updatedNodes = [...nodesData, newNode];
        const updatedPositions = { ...positionMap, [newId]: newPos };
        setNodesData(updatedNodes);
        setPositionMap(updatedPositions);
        scheduleSave(
          { nodes: updatedNodes, positions: updatedPositions },
          100,
        );
      },
      onDeleteNode: (id: string) => {
        // Remove this id and all descendants.
        const idsToRemove = new Set<string>([id]);
        let added = true;
        while (added) {
          added = false;
          for (const n of nodesData) {
            if (n.parent && idsToRemove.has(n.parent) && !idsToRemove.has(n.id)) {
              idsToRemove.add(n.id);
              added = true;
            }
          }
        }
        const updatedNodes = nodesData.filter((n) => !idsToRemove.has(n.id));
        const updatedPositions = { ...positionMap };
        for (const rid of idsToRemove) delete updatedPositions[rid];
        setNodesData(updatedNodes);
        setPositionMap(updatedPositions);
        scheduleSave(
          { nodes: updatedNodes, positions: updatedPositions },
          100,
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesData, positionMap],
  );

  // Compute layout (auto + pinned overrides + collision relief)
  const laidOut = useMemo(
    () => resolvePositions(nodesData, positionMap),
    [nodesData, positionMap],
  );

  const initialReactFlow = useMemo(() => {
    const reactNodes: Node<EditableNodeData>[] = nodesData.map((n, i) => ({
      id: n.id,
      type: "editable",
      position: { x: laidOut[i].x, y: laidOut[i].y },
      data: {
        label: n.label,
        level: laidOut[i].level,
        onChange: handlers.onLabelChange,
        onAddChild: handlers.onAddChild,
        onDelete: handlers.onDeleteNode,
      },
      draggable: true,
    }));
    const reactEdges: Edge[] = nodesData
      .filter((n) => n.parent)
      .map((n) => ({
        id: `${n.parent}-${n.id}`,
        source: n.parent as string,
        target: n.id,
        type: "floating",
        style: { stroke: "#a1a1aa", strokeWidth: 1.5 },
      }));
    return { reactNodes, reactEdges };
  }, [nodesData, laidOut, handlers]);

  const [rfNodes, setRfNodes] = useState<Node<EditableNodeData>[]>(
    initialReactFlow.reactNodes,
  );
  const [rfEdges, setRfEdges] = useState<Edge[]>(initialReactFlow.reactEdges);

  useEffect(() => {
    setRfNodes(initialReactFlow.reactNodes);
    setRfEdges(initialReactFlow.reactEdges);
  }, [initialReactFlow]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<EditableNodeData>>[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds));

      // Persist position changes that finished (dragging: false).
      const finishedDrags = changes.filter(
        (c): c is NodePositionChange =>
          c.type === "position" && c.dragging === false && c.position != null,
      );
      if (finishedDrags.length > 0) {
        setPositionMap((prev) => {
          const next = { ...prev };
          for (const c of finishedDrags) {
            next[c.id] = { x: c.position!.x, y: c.position!.y };
          }
          scheduleSave({ nodes: nodesData, positions: next });
          return next;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesData],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setRfEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  if (nodesData.length === 0) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[var(--wc-faint)] p-6">
        Nothing to map yet.
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full bg-[var(--wc-paper)]">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={24} color="#d4d4d8" />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap pannable zoomable position="bottom-left" />
      </ReactFlow>
    </div>
  );
}
