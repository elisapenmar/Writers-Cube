"use client";

import { useEffect, useRef, useState } from "react";
import {
  getCanvas,
  saveCanvas,
  type CanvasItem,
  type CanvasState,
} from "@/server/canvas";

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1800;
const MAX_IMAGE_BYTES = 800_000; // ~800 KB; bigger images get downscaled client-side

export function CanvasTab() {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const state = await getCanvas();
        setItems(state.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  function scheduleSave(next: CanvasItem[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveCanvas({ items: next }).catch((e) => {
        setError(e instanceof Error ? e.message : "Save failed");
      });
    }, 400);
  }

  function update(next: CanvasItem[]) {
    setItems(next);
    scheduleSave(next);
  }

  function patchItem(id: string, patch: Partial<CanvasItem>) {
    update(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    update(items.filter((it) => it.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function addTextBox() {
    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    const newItem: CanvasItem = {
      id: `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      type: "text",
      x: scrollLeft + 80,
      y: scrollTop + 80,
      width: 220,
      height: 100,
      content: "",
    };
    update([...items, newItem]);
    setSelectedId(newItem.id);
  }

  function triggerImagePick() {
    fileInputRef.current?.click();
  }

  async function handleImageFile(file: File) {
    setError(null);
    try {
      const dataUrl = await readImage(file);
      const dims = await getImageDimensions(dataUrl);
      const scrollLeft = containerRef.current?.scrollLeft ?? 0;
      const scrollTop = containerRef.current?.scrollTop ?? 0;
      const maxDisplay = 320;
      const ratio = Math.min(1, maxDisplay / Math.max(dims.width, dims.height));
      const newItem: CanvasItem = {
        id: `i-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        type: "image",
        x: scrollLeft + 100,
        y: scrollTop + 100,
        width: Math.round(dims.width * ratio),
        height: Math.round(dims.height * ratio),
        content: dataUrl,
      };
      update([...items, newItem]);
      setSelectedId(newItem.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add image");
    }
  }

  async function readImage(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Pick an image file");
    }
    const arrayBuf = await file.arrayBuffer();
    if (arrayBuf.byteLength > MAX_IMAGE_BYTES) {
      // Downscale via canvas
      const blob = new Blob([arrayBuf], { type: file.type });
      const url = URL.createObjectURL(blob);
      try {
        const img = await loadImage(url);
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unsupported");
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL("image/jpeg", 0.85);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
  }

  function getImageDimensions(
    dataUrl: string,
  ): Promise<{ width: number; height: number }> {
    return loadImage(dataUrl).then((img) => ({
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    }));
  }

  function onDropFile(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleImageFile(file);
  }

  if (!hydrated) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-zinc-500 p-6">
        Loading canvas…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs">
        <button
          onClick={addTextBox}
          className="rounded-md bg-zinc-900 px-2.5 py-1 text-white hover:bg-zinc-800"
        >
          + Text
        </button>
        <button
          onClick={triggerImagePick}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-zinc-700 hover:bg-zinc-50"
        >
          + Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
            if (e.target) e.target.value = "";
          }}
        />
        <span className="ml-auto text-zinc-400">
          Drag files in · drag items to arrange · double-click text to edit
        </span>
      </div>

      <div
        ref={containerRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropFile}
        onClick={() => setSelectedId(null)}
        className="flex-1 overflow-auto bg-zinc-100"
        style={{ touchAction: "none" }}
      >
        <div
          className="relative"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            backgroundImage:
              "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {items.map((item) => (
            <CanvasItemView
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={() => setSelectedId(item.id)}
              onPatch={(p) => patchItem(item.id, p)}
              onDelete={() => removeItem(item.id)}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-xs text-red-800 flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function CanvasItemView({
  item,
  selected,
  onSelect,
  onPatch,
  onDelete,
}: {
  item: CanvasItem;
  selected: boolean;
  onSelect: () => void;
  onPatch: (patch: Partial<CanvasItem>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [textDraft, setTextDraft] = useState(item.content);

  useEffect(() => setTextDraft(item.content), [item.content]);

  function onDragStart(e: React.PointerEvent) {
    if (editing) return;
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    e.preventDefault();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startItemX = item.x;
    const startItemY = item.y;
    const move = (ev: PointerEvent) => {
      onPatch({
        x: Math.max(0, startItemX + (ev.clientX - startX)),
        y: Math.max(0, startItemY + (ev.clientY - startY)),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = item.width;
    const startH = item.height;
    const isImage = item.type === "image";
    const ratio = isImage && startH > 0 ? startW / startH : 0;
    const move = (ev: PointerEvent) => {
      let nextW = Math.max(40, startW + (ev.clientX - startX));
      let nextH = Math.max(30, startH + (ev.clientY - startY));
      if (isImage && ratio > 0) {
        // Maintain aspect ratio for images
        if (Math.abs(ev.clientX - startX) > Math.abs(ev.clientY - startY)) {
          nextH = Math.round(nextW / ratio);
        } else {
          nextW = Math.round(nextH * ratio);
        }
      }
      onPatch({ width: nextW, height: nextH });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      onPointerDown={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={() => {
        if (item.type === "text") setEditing(true);
      }}
      className={`absolute select-none ${
        selected ? "outline outline-2 outline-amber-400 outline-offset-2" : ""
      }`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        cursor: editing ? "text" : "move",
      }}
    >
      {item.type === "text" ? (
        editing ? (
          <textarea
            autoFocus
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (textDraft !== item.content) onPatch({ content: textDraft });
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTextDraft(item.content);
                setEditing(false);
              }
            }}
            className="w-full h-full bg-white border border-zinc-300 rounded p-2 text-sm font-serif resize-none focus:outline-none focus:border-zinc-500 shadow"
          />
        ) : (
          <div className="w-full h-full bg-white border border-zinc-200 rounded p-2 text-sm font-serif text-zinc-800 overflow-hidden whitespace-pre-wrap shadow hover:border-zinc-400">
            {item.content || (
              <span className="italic text-zinc-400">Double-click to edit</span>
            )}
          </div>
        )
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.content}
          alt=""
          className="w-full h-full object-cover rounded shadow border border-zinc-200 pointer-events-none"
          draggable={false}
        />
      )}

      {selected && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
            className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-white border border-zinc-300 text-zinc-500 hover:bg-red-600 hover:text-white shadow text-xs leading-none flex items-center justify-center"
          >
            ×
          </button>
          <div
            onPointerDown={onResizeStart}
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-400 border border-white cursor-se-resize"
          />
        </>
      )}
    </div>
  );
}
