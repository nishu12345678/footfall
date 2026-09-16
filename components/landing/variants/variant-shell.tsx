"use client";

import {
  Children,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/* ---------------------------------------------------------------------------
   A design-review harness, for this branch only.

   Wrap any section in <VariantSwitch> and it gets a small ◀ 2/8 ▶ pill in its
   top-right corner that flips between alternative treatments of that section.
   One floating button hides every pill at once, so the page can be judged
   without the furniture in the way. Hover a section and ← / → work too.

   Choices survive a reload. They live in localStorage rather than React state
   so that reading them is a subscription to an external store — which is what
   useSyncExternalStore is for, and which keeps the first client paint
   identical to the server's without a setState-in-effect hydration dance.

   Nothing here should reach main. When a treatment wins, inline it into the
   real component and delete this folder.
--------------------------------------------------------------------------- */

const KEY_VISIBLE = "ff:variants:visible";
const KEY_PICK = "ff:variants:pick";

type State = { visible: boolean; picks: Record<string, number> };

/** What the server renders, and what the client hydrates against. */
const SERVER_STATE: State = { visible: true, picks: {} };

let cache: State | null = null;
const listeners = new Set<() => void>();

function readStorage(): State {
  if (cache) return cache;
  let visible = true;
  let picks: Record<string, number> = {};
  try {
    const v = localStorage.getItem(KEY_VISIBLE);
    if (v !== null) visible = v === "1";
    const p = localStorage.getItem(KEY_PICK);
    if (p) picks = JSON.parse(p) as Record<string, number>;
  } catch {
    /* private mode or storage disabled — defaults are fine */
  }
  cache = { visible, picks };
  return cache;
}

function commit(next: State) {
  cache = next;
  try {
    localStorage.setItem(KEY_VISIBLE, next.visible ? "1" : "0");
    localStorage.setItem(KEY_PICK, JSON.stringify(next.picks));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function useVariantState(): State {
  return useSyncExternalStore(subscribe, readStorage, () => SERVER_STATE);
}

function setVisible(visible: boolean) {
  commit({ ...readStorage(), visible });
}

function setPick(id: string, i: number) {
  const s = readStorage();
  commit({ ...s, picks: { ...s.picks, [id]: i } });
}

/**
 * Put this once, around the whole landing page. It only renders the floating
 * show/hide button — every switch reads the store directly.
 */
export function VariantProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <VariantToggle />
    </>
  );
}

/** The one button that hides or shows every pill on the page. */
function VariantToggle() {
  const { visible } = useVariantState();

  /* V is a global shortcut for the same thing. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "v" && e.key !== "V") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      setVisible(!readStorage().visible);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setVisible(!visible)}
      aria-pressed={!visible}
      className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-full border border-white/15 bg-[#0b0f17]/90 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg backdrop-blur transition-colors hover:bg-[#0b0f17]"
      title="Show or hide the variant controls"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          visible ? "bg-[#34d399]" : "bg-[#f59e0b]"
        }`}
      />
      {visible ? "Hide variant controls" : "Show variant controls"}
      <kbd className="rounded border border-white/20 px-1 text-[10px] leading-4 text-white/60">
        V
      </kbd>
    </button>
  );
}

/**
 * One switchable section. Each child is one treatment; `names` labels them.
 * Only the chosen child is mounted, so the photo variants don't fetch their
 * images until you actually land on them.
 */
export function VariantSwitch({
  id,
  label,
  names,
  children,
}: {
  id: string;
  label: string;
  names: string[];
  children: ReactNode;
}) {
  const { visible, picks } = useVariantState();
  const items = Children.toArray(children);
  const count = items.length;

  const raw = picks[id] ?? 0;
  const index = count > 0 ? ((raw % count) + count) % count : 0;

  const go = useCallback(
    (step: number) => setPick(id, (((index + step) % count) + count) % count),
    [id, index, count],
  );

  /* ← / → drive whichever section the pointer is over. */
  const [hot, setHot] = useState(false);
  useEffect(() => {
    if (!hot) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hot, go]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
    >
      {visible ? (
        <div className="pointer-events-none absolute right-4 top-3 z-40 flex justify-end md:right-6 md:top-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/90 p-1 shadow-[0_6px_22px_-8px_rgba(17,24,39,.35)] backdrop-blur">
            <Arrow dir="left" onClick={() => go(-1)} label={`Previous ${label}`} />
            <span className="min-w-[9rem] px-1 text-center text-[12px] leading-tight">
              <span className="block font-semibold text-[#111827]">
                {label} {index + 1}/{count}
              </span>
              <span className="block text-[11px] text-[#6b7280]">
                {names[index] ?? ""}
              </span>
            </span>
            <Arrow dir="right" onClick={() => go(1)} label={`Next ${label}`} />
          </div>
        </div>
      ) : null}

      {items[index]}
    </div>
  );
}

function Arrow({
  dir,
  onClick,
  label,
}: {
  dir: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-[#374151] transition-colors hover:bg-[#f3f4f6] active:bg-[#e5e7eb]"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={dir === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}
