/**
 * Shown while footfall does something on the owner's behalf.
 *
 * Shop owners don't press "research" buttons — they wait a moment and then
 * confirm what came back. This is the waiting: one quiet line with three
 * thinking dots. It has no box of its own, so it sits inside whatever
 * card or section is doing the work without adding another layer.
 */
export function Working({
  label,
  hint = "this takes a few seconds",
}: {
  label: string;
  hint?: string | null;
}) {
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3">
      <span
        aria-hidden
        className="thinking mt-[9px] flex flex-none items-center gap-1 text-ink"
      >
        <span />
        <span />
        <span />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] text-muted">{hint}</span> : null}
      </span>
    </div>
  );
}
