"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Indent } from "@/lib/indent";
import { useEffect, useRef, useState } from "react";
import { ALL_TAG_MARKS } from "@/lib/tag-mark";
import { updateSceneContent } from "@/server/scenes";

type GoalType = "words" | "minutes";
type FontSize = "comfortable" | "large" | "huge";

const FONT_SIZE_PX: Record<FontSize, number> = {
  comfortable: 22,
  large: 28,
  huge: 36,
};

type Phase = "config" | "active" | "done";

export function TypewriterMode({
  scene,
  onExit,
  persist,
  initialGoalType,
  initialGoalValue,
  autoStart,
  promptHeader,
}: {
  scene: { id: string; title: string; content: unknown; word_count: number };
  onExit: (finalDoc?: unknown, finalWordCount?: number) => void;
  /** When provided, used to save instead of writing to the scenes table. */
  persist?: (doc: unknown, wordCount: number) => void | Promise<void>;
  initialGoalType?: GoalType;
  initialGoalValue?: number;
  /** Skip the config screen and begin writing immediately. */
  autoStart?: boolean;
  /** Optional prompt text shown above the locked editor. */
  promptHeader?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(autoStart ? "active" : "config");
  const [goalType, setGoalType] = useState<GoalType>(initialGoalType ?? "words");
  const [goalValue, setGoalValue] = useState<number>(initialGoalValue ?? 250);
  const [fontSize, setFontSize] = useState<FontSize>("comfortable");
  const [lockBackspace, setLockBackspace] = useState(false);

  const [startWords, setStartWords] = useState(scene.word_count);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [currentWords, setCurrentWords] = useState<number>(scene.word_count);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  // Tick clock during active session
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, startTime]);

  // Latest doc captured from the inner editor on each update
  const latestDocRef = useRef<unknown>(scene.content);
  const latestWordsRef = useRef<number>(scene.word_count);

  function exit() {
    onExit(latestDocRef.current, latestWordsRef.current);
  }

  // Escape key to exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    setStartWords(scene.word_count);
    setCurrentWords(scene.word_count);
    setStartTime(Date.now());
    setElapsedSec(0);
    setPhase("active");
  }

  const wordsWritten = Math.max(0, currentWords - startWords);
  const goalMet =
    goalType === "words"
      ? wordsWritten >= goalValue
      : elapsedSec >= goalValue * 60;

  // When goal met, advance to "done" phase but don't auto-exit
  useEffect(() => {
    if (phase === "active" && goalMet) setPhase("done");
  }, [phase, goalMet]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-zinc-100">
      <button
        onClick={exit}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white grid place-items-center text-lg"
        title="Exit typewriter mode (Esc)"
      >
        ×
      </button>

      {phase === "config" && (
        <ConfigScreen
          goalType={goalType}
          setGoalType={setGoalType}
          goalValue={goalValue}
          setGoalValue={setGoalValue}
          fontSize={fontSize}
          setFontSize={setFontSize}
          lockBackspace={lockBackspace}
          setLockBackspace={setLockBackspace}
          sceneTitle={scene.title}
          onStart={start}
          onCancel={exit}
        />
      )}

      {(phase === "active" || phase === "done") && (
        <ActiveSession
          scene={scene}
          persist={persist}
          promptHeader={promptHeader}
          fontSizePx={FONT_SIZE_PX[fontSize]}
          fontSize={fontSize}
          setFontSize={setFontSize}
          goalType={goalType}
          goalValue={goalValue}
          lockBackspace={lockBackspace}
          wordsWritten={wordsWritten}
          elapsedSec={elapsedSec}
          goalMet={phase === "done"}
          onWordCount={(n) => {
            setCurrentWords(n);
            latestWordsRef.current = n;
          }}
          onDocChange={(d) => {
            latestDocRef.current = d;
          }}
          onExit={exit}
        />
      )}
    </div>
  );
}

function ConfigScreen({
  goalType,
  setGoalType,
  goalValue,
  setGoalValue,
  fontSize,
  setFontSize,
  lockBackspace,
  setLockBackspace,
  sceneTitle,
  onStart,
  onCancel,
}: {
  goalType: GoalType;
  setGoalType: (t: GoalType) => void;
  goalValue: number;
  setGoalValue: (n: number) => void;
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
  lockBackspace: boolean;
  setLockBackspace: (v: boolean) => void;
  sceneTitle: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <div className="text-xs uppercase tracking-widest text-zinc-500">
            Typewriter session
          </div>
          <h2 className="font-serif text-2xl">{sceneTitle}</h2>
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-zinc-400">Goal</label>
          <div className="flex gap-2">
            <button
              onClick={() => setGoalType("words")}
              className={`flex-1 rounded-md py-2 text-sm border ${
                goalType === "words"
                  ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              Word count
            </button>
            <button
              onClick={() => setGoalType("minutes")}
              className={`flex-1 rounded-md py-2 text-sm border ${
                goalType === "minutes"
                  ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              Time
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={goalValue}
              onChange={(e) =>
                setGoalValue(Math.max(1, parseInt(e.target.value || "0", 10)))
              }
              className="flex-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-base focus:outline-none focus:border-zinc-500"
            />
            <span className="text-sm text-zinc-400 w-16">
              {goalType === "words" ? "words" : "minutes"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-zinc-400">Font size</label>
          <div className="flex gap-2">
            {(["comfortable", "large", "huge"] as FontSize[]).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`flex-1 rounded-md py-2 text-sm border capitalize ${
                  fontSize === s
                    ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={lockBackspace}
            onChange={(e) => setLockBackspace(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
          />
          Don&apos;t allow backspace
          <span className="text-xs text-zinc-500">— no deleting, only forward</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md py-2.5 text-sm text-zinc-400 hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="flex-[2] rounded-md py-2.5 text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-white"
          >
            Start writing
          </button>
        </div>
      </div>
    </div>
  );
}

function ActiveSession({
  scene,
  persist,
  promptHeader,
  fontSizePx,
  fontSize,
  setFontSize,
  goalType,
  goalValue,
  lockBackspace,
  wordsWritten,
  elapsedSec,
  goalMet,
  onWordCount,
  onDocChange,
  onExit,
}: {
  scene: { id: string; title: string; content: unknown; word_count: number };
  persist?: (doc: unknown, wordCount: number) => void | Promise<void>;
  promptHeader?: React.ReactNode;
  fontSizePx: number;
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
  goalType: GoalType;
  goalValue: number;
  lockBackspace: boolean;
  wordsWritten: number;
  elapsedSec: number;
  goalMet: boolean;
  onWordCount: (n: number) => void;
  onDocChange: (doc: unknown) => void;
  onExit: () => void;
}) {
  function saveDoc(doc: unknown, wc: number) {
    if (persist) void Promise.resolve(persist(doc, wc)).catch(() => {});
    else void updateSceneContent(scene.id, doc).catch(() => {});
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  // Reset dismissal whenever a fresh goal-met transition happens
  useEffect(() => {
    if (goalMet) setCelebrationDismissed(false);
  }, [goalMet]);

  const editor = useEditor(
    {
      extensions: [StarterKit, Underline, Indent, ...ALL_TAG_MARKS],
      content: (scene.content as object | null) ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "focus:outline-none font-serif leading-relaxed",
          spellcheck: "false",
        },
        handleKeyDown: lockBackspace
          ? (_view, event) => {
              // Hardcore mode: no deleting — only forward.
              if (event.key === "Backspace" || event.key === "Delete") {
                event.preventDefault();
                return true;
              }
              return false;
            }
          : undefined,
      },
      onUpdate: ({ editor }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        const doc = editor.getJSON();
        const wc = countWordsInJSON(doc);
        onWordCount(wc);
        onDocChange(doc);
        saveTimer.current = setTimeout(() => {
          saveDoc(doc, wc);
        }, 800);
        scrollCursorToCenter();
      },
      onSelectionUpdate: () => {
        scrollCursorToCenter();
      },
    },
    [scene.id],
  );

  function scrollCursorToCenter() {
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      let rect = range.getBoundingClientRect();
      if (rect.top === 0 && rect.bottom === 0) {
        // Caret in empty paragraph — get the containing element instead
        const node = sel.anchorNode as HTMLElement | null;
        if (node) {
          const el =
            node.nodeType === Node.ELEMENT_NODE
              ? (node as HTMLElement)
              : node.parentElement;
          if (el) rect = el.getBoundingClientRect();
        }
      }
      const vp = viewportRef.current;
      if (!vp) return;
      const vpRect = vp.getBoundingClientRect();
      const targetCenter = vpRect.top + vpRect.height / 2;
      const delta = rect.top - targetCenter;
      vp.scrollBy({ top: delta, behavior: "smooth" });
    });
  }

  // Initial centering
  useEffect(() => {
    if (editor) {
      requestAnimationFrame(() => {
        editor.commands.focus("end");
        scrollCursorToCenter();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Flush save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current && editor) {
        clearTimeout(saveTimer.current);
        const doc = editor.getJSON();
        saveDoc(doc, countWordsInJSON(doc));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress =
    goalType === "words"
      ? `${wordsWritten} / ${goalValue} words`
      : `${formatTime(elapsedSec)} / ${goalValue}:00`;

  return (
    <>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 text-xs text-zinc-500">
        <span>{progress}</span>
        <span className="text-zinc-700">·</span>
        <FontSizeChip fontSize={fontSize} setFontSize={setFontSize} />
      </div>

      <div
        ref={viewportRef}
        className="absolute inset-0 overflow-y-auto wc-typewriter-viewport"
        style={{
          // Hide scrollbars across browsers
          scrollbarWidth: "none",
        }}
      >
        <div
          className="mx-auto max-w-2xl px-6"
          style={{
            // Give space above and below so first/last lines can sit at center
            paddingTop: promptHeader ? "30vh" : "50vh",
            paddingBottom: "50vh",
            fontSize: `${fontSizePx}px`,
            lineHeight: 1.6,
            color: "#e4e4e7",
            caretColor: "#fafafa",
          }}
        >
          {promptHeader && (
            <div className="mb-8 text-zinc-500 text-base leading-relaxed border-l-2 border-zinc-700 pl-4">
              {promptHeader}
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      {goalMet && !celebrationDismissed && (
        <Celebration
          goalType={goalType}
          goalValue={goalValue}
          wordsWritten={wordsWritten}
          elapsedSec={elapsedSec}
          onDone={onExit}
          onKeepGoing={() => setCelebrationDismissed(true)}
        />
      )}
    </>
  );
}

function Celebration({
  goalType,
  goalValue,
  wordsWritten,
  elapsedSec,
  onDone,
  onKeepGoing,
}: {
  goalType: GoalType;
  goalValue: number;
  wordsWritten: number;
  elapsedSec: number;
  onDone: () => void;
  onKeepGoing: () => void;
}) {
  const goalLine =
    goalType === "words"
      ? `You set out to write ${goalValue} words.`
      : `You set out to write for ${goalValue} minutes.`;
  const statLine = `${wordsWritten} word${wordsWritten === 1 ? "" : "s"} in ${formatTime(elapsedSec)}.`;

  return (
    <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
      <div className="relative wc-celebration-card pointer-events-auto">
        <div className="absolute -inset-6 rounded-3xl wc-celebration-glow pointer-events-none" />
        <div className="relative rounded-2xl bg-zinc-950/95 border border-zinc-800 px-8 py-5 shadow-2xl flex items-center gap-6">
          <div className="text-left">
            <div className="font-serif italic text-zinc-500 text-xs tracking-wide">
              Goal reached
            </div>
            <div className="font-serif text-2xl text-zinc-50 leading-tight">
              Beautiful work.
            </div>
            <p className="mt-1 text-zinc-400 text-xs">
              {goalLine}{" "}
              <span className="text-zinc-200">{statLine}</span>
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 shrink-0">
            <button
              onClick={onDone}
              className="rounded-full bg-zinc-100 text-zinc-900 px-4 py-1.5 text-xs font-medium hover:bg-white shadow"
            >
              Finish
            </button>
            <button
              onClick={onKeepGoing}
              className="rounded-full px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-100"
            >
              Keep writing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FontSizeChip({
  fontSize,
  setFontSize,
}: {
  fontSize: FontSize;
  setFontSize: (f: FontSize) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {(["comfortable", "large", "huge"] as FontSize[]).map((s) => (
        <button
          key={s}
          onClick={() => setFontSize(s)}
          className={`px-1.5 ${
            fontSize === s ? "text-zinc-100" : "text-zinc-600 hover:text-zinc-300"
          }`}
          title={s}
        >
          {s === "comfortable" ? "A" : s === "large" ? "A" : "A"}
          <span style={{ fontSize: s === "comfortable" ? 10 : s === "large" ? 13 : 16 }}>
            {/* visual hint */}
          </span>
        </button>
      ))}
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function countWordsInJSON(doc: unknown): number {
  let text = "";
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && typeof node.text === "string") text += " " + node.text;
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return text.trim().split(/\s+/).filter(Boolean).length;
}
