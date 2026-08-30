/**
 * Shown while footfall does something on the owner's behalf.
 *
 * Shop owners don't press "research" buttons — they wait a moment and then
 * confirm what came back. This is the waiting.
 */
export function Working({ label }: { label: string }) {
  return (
    <div className="rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]">
      <p className="flex items-center gap-2 font-display text-[14px] font-bold">
        <span aria-hidden className="text-pin">
          ✦
        </span>
        {label}
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-3"
        role="progressbar"
        aria-label={label}
      >
        <span className="sweep block h-full w-1/3 rounded-full bg-pin" />
      </div>
      <p className="mt-2 font-mono text-[10px] text-muted">
        this takes a few seconds
      </p>
    </div>
  );
}
