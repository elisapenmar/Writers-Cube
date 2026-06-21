"use client";

import { useMemo, useState, useTransition } from "react";
import {
  type PublishSettings,
  type BodyFont,
  type LineSpacing,
  type ParagraphStyle,
  type ChapterHeadingStyle,
  type TrimSize,
  FONT_STACKS,
  TRIM_SIZES,
  LINE_SPACING_VALUE,
  SCENE_BREAK_PRESETS,
  chapterHeading,
} from "@/lib/publish-types";
import { savePublishSettings } from "@/server/publish";

export type PublishSample = { chapterTitle: string; paragraphs: string[] };

export function PublishStudio({
  projectId,
  projectTitle,
  initial,
  sample,
}: {
  projectId: string;
  projectTitle: string;
  initial: PublishSettings;
  sample: PublishSample;
}) {
  const [s, setS] = useState<PublishSettings>(initial);
  const [saving, startSave] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function update<K extends keyof PublishSettings>(key: K, value: PublishSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function save() {
    startSave(async () => {
      await savePublishSettings(projectId, s);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setDirty(false);
    });
  }

  // Export links must reflect saved settings — save first if dirty.
  const exportHref = (format: string) =>
    `/app/export?project=${projectId}&format=${format}`;

  return (
    <div className="flex-1 overflow-y-auto wc-cube-bg">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--wc-slate)]">
              Prepare for publication
            </div>
            <h1 className="font-serif text-3xl text-[var(--wc-ink)]">{projectTitle}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Set your book&apos;s metadata and formatting, then export to ebook, print, or Word.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            {!dirty && savedAt && <span className="text-xs text-zinc-400">Saved {savedAt}</span>}
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
              style={{ background: "var(--wc-slate)" }}
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
          {/* ---- Controls ---- */}
          <div className="space-y-6">
            <Panel title="Book details" hint="Used on the title & copyright pages and in ebook metadata.">
              <Grid>
                <Text label="Title" value={s.title ?? ""} onChange={(v) => update("title", v)} placeholder={projectTitle} />
                <Text label="Subtitle" value={s.subtitle ?? ""} onChange={(v) => update("subtitle", v)} />
                <Text label="Author" value={s.author ?? ""} onChange={(v) => update("author", v)} />
                <Text label="Publisher" value={s.publisher ?? ""} onChange={(v) => update("publisher", v)} placeholder="Optional" />
                <Text label="Copyright year" value={s.copyrightYear ?? ""} onChange={(v) => update("copyrightYear", v)} placeholder={String(new Date().getFullYear())} />
                <Text label="ISBN" value={s.isbn ?? ""} onChange={(v) => update("isbn", v)} placeholder="Optional" />
                <Text label="Rights line" value={s.rights ?? ""} onChange={(v) => update("rights", v)} />
                <Text label="Language" value={s.language ?? ""} onChange={(v) => update("language", v)} placeholder="en" />
              </Grid>
              <Area label="Description (ebook blurb)" value={s.description ?? ""} onChange={(v) => update("description", v)} />
              <Area label="Dedication" value={s.dedication ?? ""} onChange={(v) => update("dedication", v)} placeholder="For…" />
            </Panel>

            <Panel title="Typography" hint="How the body text reads. Serif fonts are standard for novels.">
              <Grid>
                <Select
                  label="Body font"
                  value={s.bodyFont}
                  onChange={(v) => update("bodyFont", v as BodyFont)}
                  options={(Object.keys(FONT_STACKS) as BodyFont[]).map((f) => ({ value: f, label: FONT_STACKS[f].label }))}
                />
                <NumberField label="Font size (pt)" value={s.fontSize} min={9} max={16} onChange={(v) => update("fontSize", v)} />
                <Select
                  label="Line spacing"
                  value={s.lineSpacing}
                  onChange={(v) => update("lineSpacing", v as LineSpacing)}
                  options={[
                    { value: "single", label: "Single" },
                    { value: "1.5", label: "1.5 lines" },
                    { value: "double", label: "Double (submission)" },
                  ]}
                />
                <Select
                  label="Paragraphs"
                  value={s.paragraphStyle}
                  onChange={(v) => update("paragraphStyle", v as ParagraphStyle)}
                  options={[
                    { value: "indent", label: "First-line indent (book)" },
                    { value: "spaced", label: "Block + space (web)" },
                  ]}
                />
              </Grid>
              <div className="flex flex-wrap gap-4 pt-1">
                <Toggle label="Justify text" checked={s.justify} onChange={(v) => update("justify", v)} />
                <Toggle label="Drop caps at chapter starts" checked={s.dropCaps} onChange={(v) => update("dropCaps", v)} />
              </div>
            </Panel>

            <Panel title="Chapters & scenes">
              <Grid>
                <Select
                  label="Chapter headings"
                  value={s.chapterHeadingStyle}
                  onChange={(v) => update("chapterHeadingStyle", v as ChapterHeadingStyle)}
                  options={[
                    { value: "numbered-title", label: "Chapter 1 — Title" },
                    { value: "numbered", label: "Chapter 1" },
                    { value: "title", label: "Title only" },
                  ]}
                />
                <Select
                  label="Scene break"
                  value={s.sceneBreak}
                  onChange={(v) => update("sceneBreak", v)}
                  options={SCENE_BREAK_PRESETS.map((p) => ({ value: p, label: p }))}
                />
              </Grid>
              <div className="pt-1">
                <Toggle label="Start each chapter on a new page" checked={s.chaptersNewPage} onChange={(v) => update("chaptersNewPage", v)} />
              </div>
            </Panel>

            <Panel title="Front & back matter">
              <div className="flex flex-wrap gap-4">
                <Toggle label="Title page" checked={s.titlePage} onChange={(v) => update("titlePage", v)} />
                <Toggle label="Copyright page" checked={s.copyrightPage} onChange={(v) => update("copyrightPage", v)} />
                <Toggle label="Table of contents" checked={s.tableOfContents} onChange={(v) => update("tableOfContents", v)} />
                <Toggle label="“The End”" checked={s.theEnd} onChange={(v) => update("theEnd", v)} />
              </div>
            </Panel>

            <Panel title="Print layout" hint="Trim size affects the Print PDF only. 5.5×8.5 and 6×9 are common trade sizes.">
              <Grid>
                <Select
                  label="Trim size"
                  value={s.trimSize}
                  onChange={(v) => update("trimSize", v as TrimSize)}
                  options={(Object.keys(TRIM_SIZES) as TrimSize[]).map((t) => ({ value: t, label: TRIM_SIZES[t].label }))}
                />
              </Grid>
            </Panel>
          </div>

          {/* ---- Preview + export ---- */}
          <div className="space-y-4 lg:sticky lg:top-6 self-start">
            <Preview s={s} sample={sample} />

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="mb-1 font-serif text-base text-[var(--wc-ink)]">Export</div>
              {dirty && (
                <p className="mb-2 text-[11px] text-amber-600">
                  Save your settings to include the latest changes in the file.
                </p>
              )}
              <div className="grid grid-cols-1 gap-1.5">
                <ExportRow href={exportHref("epub")} label="Ebook (.epub)" note="Kindle, Apple Books, Kobo" download />
                <ExportRow href={exportHref("pdf")} label="Print PDF" note="Opens print-ready → Save as PDF" newTab />
                <ExportRow href={exportHref("docx")} label="Word (.docx)" note="Agents, editors, Word/Docs" download />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Live preview ---------------- */

function Preview({ s, sample }: { s: PublishSettings; sample: PublishSample }) {
  const style = useMemo(() => {
    const font = FONT_STACKS[s.bodyFont].css;
    const line = LINE_SPACING_VALUE[s.lineSpacing];
    return { font, line };
  }, [s.bodyFont, s.lineSpacing]);
  const indent = s.paragraphStyle === "indent" ? "1.4em" : "0";
  const heading = chapterHeading(s.chapterHeadingStyle, 0, sample.chapterTitle);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-zinc-400">Preview</div>
      <div
        className="rounded-lg border border-zinc-100 bg-[#fcfbf8] px-6 py-7 text-[#1a1a1a] shadow-inner"
        style={{ fontFamily: style.font, lineHeight: style.line, textAlign: s.justify ? "justify" : "left" }}
      >
        <div style={{ textAlign: "center", fontSize: "1.4em", margin: "0.2em 0 1.6em" }}>{heading}</div>
        {sample.paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              margin: s.paragraphStyle === "spaced" ? "0 0 0.7em" : 0,
              textIndent: i === 0 || s.paragraphStyle === "spaced" ? 0 : indent,
            }}
          >
            {s.dropCaps && i === 0 ? (
              <>
                <span style={{ fontSize: "3em", lineHeight: 0.8, float: "left", paddingRight: "0.06em" }}>
                  {p.charAt(0)}
                </span>
                {p.slice(1)}
              </>
            ) : (
              p
            )}
          </p>
        ))}
        <p style={{ textAlign: "center", letterSpacing: "0.3em", margin: "1.4em 0 0" }}>{s.sceneBreak}</p>
      </div>
    </div>
  );
}

/* ---------------- Field primitives ---------------- */

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="font-serif text-lg text-[var(--wc-ink)]">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-xs text-zinc-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300"
      />
      {label}
    </label>
  );
}

function ExportRow({
  href,
  label,
  note,
  download,
  newTab,
}: {
  href: string;
  label: string;
  note: string;
  download?: boolean;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      download={download}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener" : undefined}
      className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 hover:border-zinc-300 hover:bg-zinc-50"
    >
      <span className="text-sm text-zinc-800">{label}</span>
      <span className="text-[11px] text-zinc-400">{note}</span>
    </a>
  );
}
