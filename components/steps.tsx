import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

/**
 * The onboarding progress bar that sits above every setup screen.
 *
 * Steps the owner has already reached are real links, so they can hop back
 * to any earlier screen, change something, and save — without walking the
 * whole flow one Back at a time. Steps ahead of them stay disabled.
 */
export function Steps({
  current,
  reached = current,
}: {
  current: number;
  /** The furthest step this business has unlocked. */
  reached?: number;
}) {
  return (
    <ol className="flex items-start justify-between gap-1">
      {ONBOARDING_STEPS.map(({ step: n, href, label }) => {
        const done = n < current;
        const active = n === current;
        const clickable = n <= Math.max(reached, current) && !active;

        const badge = (
          <span
            className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold ${
              done
                ? "bg-open text-white"
                : active
                  ? "bg-pin-soft text-pin"
                  : "bg-paper-3 text-muted"
            }`}
          >
            {done ? "✓" : n}
          </span>
        );
        const caption = (
          <span
            className={`text-center text-[10px] leading-tight ${
              active ? "font-semibold text-pin" : "text-muted"
            }`}
          >
            {label}
          </span>
        );

        return (
          <li key={label} className="flex flex-1 flex-col items-center">
            {clickable ? (
              <Link
                href={href}
                className="pressable flex flex-col items-center gap-2 rounded-[10px] p-1"
                aria-label={`Go to step ${n}: ${label}`}
              >
                {badge}
                {caption}
              </Link>
            ) : (
              <span className="flex flex-col items-center gap-2 p-1">
                {badge}
                {caption}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
