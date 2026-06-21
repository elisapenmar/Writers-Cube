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
  const [cropId, setCropId] = useState<string | null>(null);
  const [urlPrompt, setUrlPrompt] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
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

  function applyCrop(id: string, dataUrl: string, naturalW: number, naturalH: number) {
    const maxDisplay = 360;
    const ratio = Math.min(1, maxDisplay / Math.max(naturalW, naturalH));
    patchItem(id, {
      content: dataUrl,
      width: Math.max(40, Math.round(naturalW * ratio)),
      height: Math.max(30, Math.round(naturalH * ratio)),
    });
    setCropId(null);
  }

  const cropItem = cropId ? items.find((it) => it.id === cropId) ?? null : null;

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

  function addWebpage(rawUrl: string) {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const scrollLeft = containerRef.current?.scrollLeft ?? 0;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    const newItem: CanvasItem = {
      id: `w-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      type: "webpage",
      x: scrollLeft + 120,
      y: scrollTop + 120,
      width: 320,
      height: 240,
      content: url,
      url,
    };
    update([...items, newItem]);
    setSelectedId(newItem.id);
    setUrlDraft("");
    setUrlPrompt(false);
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
        <div className="relative">
          <button
            onClick={() => setUrlPrompt((o) => !o)}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-zinc-700 hover:bg-zinc-50"
          >
            + Webpage
          </button>
          {urlPrompt && (
            <div className="absolute left-0 z-30 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl">
              <input
                autoFocus
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addWebpage(urlDraft);
                  if (e.key === "Escape") setUrlPrompt(false);
                }}
                placeholder="Paste a link… e.g. example.com/article"
                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-zinc-500 focus:outline-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setUrlPrompt(false)}
                  className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addWebpage(urlDraft)}
                  className="rounded bg-zinc-900 px-2.5 py-1 text-[11px] text-white hover:bg-zinc-800"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
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
              onCrop={item.type === "image" ? () => setCropId(item.id) : undefined}
            />
          ))}
        </div>
      </div>

      {cropItem && (
        <CropOverlay
          src={cropItem.content}
          onCancel={() => setCropId(null)}
          onApply={(dataUrl, w, h) => applyCrop(cropItem.id, dataUrl, w, h)}
        />
      )}

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

function WebpageCard({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  // A live screenshot of the page, rendered like a thumbnail of the site itself.
  const shot = `https://image.thum.io/get/width/800/${url}`;

  return (
    <div className="w-full h-full rounded shadow border border-zinc-200 bg-white overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 bg-zinc-50 grid place-items-center overflow-hidden">
        {failed ? (
          <div className="text-center px-3">
            <div className="text-2xl">🔗</div>
            <div className="mt-1 text-[11px] text-zinc-500 break-all">{host}</div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot}
            alt={host}
            onError={() => setFailed(true)}
            className="w-full h-full object-cover object-top pointer-events-none"
            draggable={false}
          />
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        title={url}
        className="shrink-0 truncate border-t border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:text-[var(--wc-slate)] hover:underline"
      >
        🔗 {host}
      </a>
    </div>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function CropOverlay({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  onApply: (dataUrl: string, w: number, h: number) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [display, setDisplay] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect | null>(null);

  function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    const maxW = Math.min(560, window.innerWidth - 80);
    const maxH = window.innerHeight - 220;
    const scale = Math.min(1, maxW / nw, maxH / nh);
    const dw = Math.round(nw * scale);
    const dh = Math.round(nh * scale);
    setNatural({ w: nw, h: nh });
    setDisplay({ w: dw, h: dh });
    setCrop({ x: dw * 0.1, y: dh * 0.1, w: dw * 0.8, h: dh * 0.8 });
  }

  function startDrag(mode: "move" | "nw" | "ne" | "sw" | "se", e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!crop) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = crop;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let { x, y, w, h } = start;
      if (mode === "move") {
        x = clamp(start.x + dx, 0, display.w - w);
        y = clamp(start.y + dy, 0, display.h - h);
      } else {
        let x2 = start.x + start.w;
        let y2 = start.y + start.h;
        if (mode === "nw" || mode === "sw") x = clamp(start.x + dx, 0, x2 - 24);
        if (mode === "nw" || mode === "ne") y = clamp(start.y + dy, 0, y2 - 24);
        if (mode === "ne" || mode === "se") x2 = clamp(start.x + start.w + dx, x + 24, display.w);
        if (mode === "sw" || mode === "se") y2 = clamp(start.y + start.h + dy, y + 24, display.h);
        w = x2 - x;
        h = y2 - y;
      }
      setCrop({ x, y, w, h });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function apply() {
    const img = imgRef.current;
    if (!crop || !natural || !img) return;
    const scale = natural.w / display.w;
    const sx = Math.round(crop.x * scale);
    const sy = Math.round(crop.y * scale);
    const sw = Math.max(1, Math.round(crop.w * scale));
    const sh = Math.max(1, Math.round(crop.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const isPng = src.startsWith("data:image/png");
    const out = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.92);
    onApply(out, sw, sh);
  }

  const handle =
    "absolute w-3 h-3 bg-white border border-zinc-700 rounded-sm";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-4">
      <div className="rounded-xl bg-white p-4 shadow-2xl">
        <div className="mb-2 text-sm font-medium text-zinc-700">Crop image</div>
        <div
          className="relative select-none"
          style={{ width: display.w, height: display.h, touchAction: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onLoad}
            draggable={false}
            className="block h-full w-full"
          />
          {crop && (
            <>
              {/* dim outside the crop with a shadow ring */}
              <div
                className="absolute border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, cursor: "move" }}
                onPointerDown={(e) => startDrag("move", e)}
              >
                <div className={`${handle} -left-1.5 -top-1.5 cursor-nw-resize`} onPointerDown={(e) => startDrag("nw", e)} />
                <div className={`${handle} -right-1.5 -top-1.5 cursor-ne-resize`} onPointerDown={(e) => startDrag("ne", e)} />
                <div className={`${handle} -left-1.5 -bottom-1.5 cursor-sw-resize`} onPointerDown={(e) => startDrag("sw", e)} />
                <div className={`${handle} -right-1.5 -bottom-1.5 cursor-se-resize`} onPointerDown={(e) => startDrag("se", e)} />
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-800"
          >
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}

function CanvasItemView({
  item,
  selected,
  onSelect,
  onPatch,
  onDelete,
  onCrop,
}: {
  item: CanvasItem;
  selected: boolean;
  onSelect: () => void;
  onPatch: (patch: Partial<CanvasItem>) => void;
  onDelete: () => void;
  onCrop?: () => void;
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
      ) : item.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.content}
          alt=""
          className="w-full h-full object-cover rounded shadow border border-zinc-200 pointer-events-none"
          draggable={false}
        />
      ) : (
        <WebpageCard url={item.url ?? item.content} />
      )}

      {selected && (
        <>
          {onCrop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCrop();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Crop image"
              className="absolute -top-3 -left-3 h-6 rounded-full bg-white border border-zinc-300 px-2 text-[11px] text-zinc-600 hover:bg-zinc-900 hover:text-white shadow leading-none flex items-center justify-center"
            >
              Crop
            </button>
          )}
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
