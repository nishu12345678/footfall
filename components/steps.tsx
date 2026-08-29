/** The 5-step onboarding progress bar that sits above every setup screen. */
export function Steps({ current }: { current: number }) {
  const steps = ["Connect", "Location", "About", "GBP Info", "Others"];
  return (
    <ol className="flex items-start justify-between gap-1">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full border font-mono text-[12px] ${
                done
                  ? "border-open bg-open text-paper-2"
                  : active
                    ? "border-pin text-pin"
                    : "border-rule text-muted"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={`text-center text-[11px] leading-tight ${
                active ? "font-semibold text-pin" : "text-muted"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
