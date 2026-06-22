"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EXPORT_FORMATS } from "@/lib/manuscript-export";
import { archiveProject } from "@/server/projects";

/** A small export/manage dropdown for a project card on the dashboard. */
export function ProjectExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"root" | "export">("root");
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }

  function openMenu() {
    setView("root");
    place();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setView("root");
  }

  // Keep the fixed menu anchored to the button while open.
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  function archive() {
    close();
    start(async () => {
      await archiveProject(projectId);
      router.refresh();
    });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          open ? close() : openMenu();
        }}
        disabled={pending}
        className="rounded-[var(--wc-r-sm)] border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2.5 py-1 text-xs text-[var(--wc-muted)] hover:border-[var(--wc-slate)] hover:text-[var(--wc-ink)] disabled:opacity-50"
        title="Export or manage this project"
      >
        {pending ? "…" : "⋯"}
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={close} />
          <div
            className="fixed z-[71] w-60 rounded-[var(--wc-r-md)] border border-[var(--wc-border)] bg-[var(--wc-surface)] p-1.5 shadow-[var(--wc-shadow-md)]"
            style={{ top: pos.top, right: pos.right }}
          >
            {view === "root" ? (
              <>
                <MenuButton onClick={() => setView("export")}>↓ Export</MenuButton>
                <Link
                  href="/app/publish"
                  onClick={close}
                  className="block rounded-lg px-2.5 py-1.5 text-sm text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
                >
                  ✦ Prepare for publication
                </Link>
                <button
                  onClick={archive}
                  className="mt-1 block w-full rounded-lg border-t border-[var(--wc-border)] px-2.5 py-1.5 text-left text-sm text-[var(--wc-muted)] hover:bg-[var(--wc-canvas)]"
                >
                  🗄 Archive project
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setView("root")}
                  className="mb-1 flex w-full items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] text-[var(--wc-faint)] hover:bg-[var(--wc-canvas)]"
                >
                  ‹ Back
                </button>
                <div className="px-2.5 pb-1 text-[10px] uppercase tracking-wide text-[var(--wc-faint)]">
                  Export · default formatting
                </div>
                {EXPORT_FORMATS.map((f) => (
                  <Link
                    key={f.id}
                    href={`/app/export?project=${projectId}&format=${f.id}`}
                    download={f.id !== "pdf"}
                    target={f.id === "pdf" ? "_blank" : undefined}
                    onClick={close}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--wc-canvas)]"
                  >
                    <span className="text-sm text-[var(--wc-ink)]">{f.label}</span>
                    <span className="ml-2 text-[10px] text-[var(--wc-faint)]">{f.note}</span>
                  </Link>
                ))}
                <Link
                  href="/app/publish"
                  onClick={close}
                  className="mt-1 block rounded-lg border-t border-[var(--wc-border)] px-2.5 py-1.5 text-xs text-[var(--wc-slate)] hover:bg-[var(--wc-canvas)]"
                >
                  ✦ Customize formatting in Prepare for publication →
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

function MenuButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--wc-ink)] hover:bg-[var(--wc-canvas)]"
    >
      <span>{children}</span>
      <span className="text-[var(--wc-faint)]">›</span>
    </button>
  );
}
