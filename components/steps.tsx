/** The onboarding progress bar that sits above every setup screen. */
export function Steps({ current }: { current: number }) {
  const steps = [
    "Connect",
    "Location",
    "About",
    "GBP Info",
    "Website",
    "Finish",
  ];
  return (
    <ol className="flex items-start justify-between gap-0.5">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold ${
                done
                  ? "bg-open text-white"
                  : active
                    ? "bg-pin-soft text-pin"
                    : "bg-paper-3 text-muted"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={`text-center text-[9px] leading-tight ${
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
