/** Shown while a writing page (manuscript / scene / chapter) streams in, so
 *  opening a project gives immediate feedback instead of a frozen dashboard. */
export default function WritingLoading() {
  return (
    <div className="flex-1 grid place-items-center bg-[var(--wc-canvas)]">
      <div className="flex items-center gap-3 text-sm text-[var(--wc-muted)]">
        <span className="wc-spinner" aria-hidden="true" />
        Opening your project…
      </div>
    </div>
  );
}
