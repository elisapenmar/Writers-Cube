"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  listBrainstorms,
  getBrainstorm,
  createBrainstorm,
  deleteBrainstorm,
  sendBrainstormMessage,
  setBrainstormMode,
  resetBrainstorm,
  updateBrainstormTitle,
  type BrainstormMessage,
  type BrainstormSummary,
} from "@/server/brainstorm";
import { BRAINSTORM_MODES, type BrainstormMode } from "@/lib/brainstorm-modes";
import { useOrganize } from "@/store/organize-store";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionLike = any;

export function BrainstormPanel() {
  const currentBrainstormId = useOrganize((s) => s.currentBrainstormId);
  const setCurrentBrainstormId = useOrganize((s) => s.setCurrentBrainstormId);

  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<BrainstormSummary[]>([]);
  const [messages, setMessages] = useState<BrainstormMessage[]>([]);
  const [mode, setMode] = useState<BrainstormMode>("open");
  const [title, setTitle] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Load history + the selected brainstorm
  useEffect(() => {
    void load(currentBrainstormId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBrainstormId]);

  async function load(id?: string) {
    try {
      const [list, current] = await Promise.all([
        listBrainstorms(),
        getBrainstorm(id),
      ]);
      setHistory(list);
      setMessages(current.messages);
      setMode(current.mode);
      setTitle(current.title);
      if (!currentBrainstormId || currentBrainstormId !== current.id) {
        setCurrentBrainstormId(current.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setHydrated(true);
    }
  }

  // Voice transcription
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: { new (): SpeechRecognitionLike };
      webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSpeechSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: any) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
      }
      if (finalText) {
        setInput((prev) =>
          (prev ? prev.trimEnd() + " " + finalText.trim() : finalText.trim()),
        );
      }
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {}
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  function toggleRecording() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (recording) {
      try { rec.stop(); } catch {}
      setRecording(false);
    } else {
      setError(null);
      try {
        rec.start();
        setRecording(true);
      } catch (e) {
        setError(`Mic error: ${(e as Error).message}`);
      }
    }
  }

  function send() {
    const text = input.trim();
    if (!text || pending || !currentBrainstormId) return;
    setInput("");
    setError(null);
    const optimistic: BrainstormMessage[] = [...messages, { role: "user", text }];
    setMessages(optimistic);
    startTransition(async () => {
      try {
        const r = await sendBrainstormMessage(currentBrainstormId, text);
        setMessages(r.messages);
        if (r.title) setTitle(r.title);
        // Refresh history so titles/summaries update
        void listBrainstorms().then(setHistory);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
        setMessages(messages);
        setInput(text);
      }
    });
  }

  function changeMode(next: BrainstormMode) {
    if (!currentBrainstormId || next === mode) return;
    if (messages.length > 0) {
      if (!confirm(`Switch to "${BRAINSTORM_MODES[next].name}" mode? Conversation continues; AI pivots on next turn.`))
        return;
    }
    setMode(next);
    startTransition(async () => {
      try {
        await setBrainstormMode(currentBrainstormId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Mode change failed");
        setMode(mode);
      }
    });
  }

  function startNew() {
    setHistoryOpen(false);
    startTransition(async () => {
      try {
        const { id } = await createBrainstorm();
        setCurrentBrainstormId(id);
        await load(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create");
      }
    });
  }

  function switchTo(id: string) {
    setHistoryOpen(false);
    setCurrentBrainstormId(id);
  }

  function clearCurrent() {
    if (!currentBrainstormId) return;
    if (!confirm("Clear this conversation? The brainstorm row stays in history (empty).")) return;
    startTransition(async () => {
      try {
        await resetBrainstorm(currentBrainstormId);
        setMessages([]);
        setTitle(null);
        void listBrainstorms().then(setHistory);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reset failed");
      }
    });
  }

  function deleteEntry(id: string) {
    if (!confirm("Delete this brainstorm permanently?")) return;
    startTransition(async () => {
      try {
        await deleteBrainstorm(id);
        if (id === currentBrainstormId) {
          setCurrentBrainstormId(null);
          await load();
        } else {
          void listBrainstorms().then(setHistory);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  function rename(next: string) {
    if (!currentBrainstormId) return;
    setTitle(next || null);
    startTransition(async () => {
      try {
        await updateBrainstormTitle(currentBrainstormId, next);
        void listBrainstorms().then(setHistory);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Rename failed");
      }
    });
  }

  if (!hydrated) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-zinc-500 p-6">
        Loading brainstorm…
      </div>
    );
  }

  const isEmpty = messages.length === 0;
  const lastAssistant =
    messages.length > 0 && messages[messages.length - 1].role === "assistant"
      ? messages[messages.length - 1].text
      : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar: title + history + mode */}
      <div className="border-b border-zinc-200 px-4 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <EditableTitle title={title} onSave={rename} />
          <HistoryButton
            open={historyOpen}
            setOpen={setHistoryOpen}
            history={history}
            currentId={currentBrainstormId}
            onNew={startNew}
            onSwitch={switchTo}
            onDelete={deleteEntry}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <ModeToggle mode={mode} setMode={changeMode} />
          <button
            onClick={clearCurrent}
            disabled={isEmpty || pending}
            className="ml-auto rounded-md px-2 py-0.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
            title="Clear the current conversation"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {isEmpty && (
            <div className="space-y-3">
              <p className="font-serif text-base text-zinc-700 leading-relaxed">
                Tell me your idea — out loud or in writing. I&apos;ll ask one question at a time.
              </p>
              <p className="text-xs text-zinc-500">
                Mode: <b className="text-zinc-700">{BRAINSTORM_MODES[mode].name}</b> — {BRAINSTORM_MODES[mode].description}
              </p>
              <ul className="space-y-1 text-xs text-zinc-600 font-serif italic">
                {BRAINSTORM_MODES[mode].openers.map((p) => (
                  <li key={p}>— {p}</li>
                ))}
              </ul>
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
          {pending && <Bubble role="assistant" text="…" subtle />}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-200 px-4 py-3">
        {lastAssistant && !isEmpty && (
          <p className="font-serif text-xs text-zinc-500 mb-2 italic">↑ {lastAssistant}</p>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={toggleRecording}
            disabled={!speechSupported}
            className={`shrink-0 w-9 h-9 rounded-full grid place-items-center ${
              recording
                ? "bg-red-600 text-white animate-pulse"
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
            } disabled:opacity-40`}
            title={
              speechSupported
                ? recording ? "Stop recording" : "Speak"
                : "Voice input requires Chrome or Edge"
            }
          >
            {recording ? "■" : "🎙"}
          </button>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={recording ? "Listening…" : "Type or speak. ⌘↩ to send."}
            rows={2}
            className="flex-1 resize-none rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-serif focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={send}
            disabled={!input.trim() || pending}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Send
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function EditableTitle({
  title,
  onSave,
}: {
  title: string | null;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  useEffect(() => setDraft(title ?? ""), [title]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() !== (title ?? "")) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(title ?? "");
            setEditing(false);
          }
        }}
        placeholder="Untitled brainstorm"
        className="flex-1 font-serif text-base bg-white border border-zinc-300 rounded px-1.5 py-0.5 outline-none"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to rename"
      className={`flex-1 text-left font-serif text-base truncate hover:bg-zinc-50 rounded px-1 -ml-1 ${
        title ? "text-zinc-900" : "text-zinc-400 italic"
      }`}
    >
      {title || "Untitled brainstorm"}
    </button>
  );
}

function HistoryButton({
  open,
  setOpen,
  history,
  currentId,
  onNew,
  onSwitch,
  onDelete,
}: {
  open: boolean;
  setOpen: (b: boolean) => void;
  history: BrainstormSummary[];
  currentId: string | null;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        title="Switch brainstorms or start a new one"
      >
        History ({history.length})
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-[22rem] max-h-[60vh] overflow-y-auto bg-white border border-zinc-200 rounded-md shadow-xl z-40">
            <div className="p-2 border-b border-zinc-200">
              <button
                onClick={onNew}
                className="w-full rounded-md bg-zinc-900 text-white px-3 py-1.5 text-xs hover:bg-zinc-800"
              >
                + New brainstorm
              </button>
            </div>
            {history.length === 0 ? (
              <p className="p-3 text-xs text-zinc-500">No brainstorms yet.</p>
            ) : (
              <ul>
                {history.map((b) => {
                  const isCurrent = b.id === currentId;
                  const d = new Date(b.updated_at);
                  const date = d.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year:
                      d.getFullYear() !== new Date().getFullYear()
                        ? "numeric"
                        : undefined,
                  });
                  const time = d.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <li
                      key={b.id}
                      className={`border-b border-zinc-100 last:border-0 group ${
                        isCurrent ? "bg-amber-50" : "hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-start gap-2 p-2">
                        <button
                          onClick={() => onSwitch(b.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-baseline gap-1.5 text-[10px] text-zinc-500">
                            <span>{date}</span>
                            <span>·</span>
                            <span>{time}</span>
                            <span>·</span>
                            <span>{b.message_count} msg</span>
                          </div>
                          <div className="font-serif text-sm text-zinc-900 mt-0.5 truncate">
                            {b.title || (
                              <span className="italic text-zinc-400">
                                Untitled
                              </span>
                            )}
                          </div>
                          {b.summary && (
                            <div className="text-[11px] text-zinc-600 mt-0.5 leading-snug line-clamp-2">
                              {b.summary}
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => onDelete(b.id)}
                          className="text-xs text-zinc-300 hover:text-red-700 opacity-0 group-hover:opacity-100 shrink-0 self-start mt-1"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: BrainstormMode;
  setMode: (m: BrainstormMode) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-zinc-300 overflow-hidden">
      {(Object.keys(BRAINSTORM_MODES) as BrainstormMode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-2 py-0.5 ${
            mode === m
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
          title={BRAINSTORM_MODES[m].description}
        >
          {BRAINSTORM_MODES[m].name}
        </button>
      ))}
    </div>
  );
}

function Bubble({
  role,
  text,
  subtle,
}: {
  role: "user" | "assistant";
  text: string;
  subtle?: boolean;
}) {
  if (role === "assistant") {
    return (
      <div
        className={`font-serif text-sm leading-relaxed ${
          subtle ? "text-zinc-400" : "text-zinc-800"
        }`}
      >
        {text}
      </div>
    );
  }
  return (
    <div className="bg-zinc-100 rounded-2xl rounded-tr-sm px-3 py-2 ml-auto max-w-[85%] font-serif text-sm text-zinc-800 leading-relaxed">
      {text}
    </div>
  );
}
