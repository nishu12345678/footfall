import Image from "next/image";
import { APP_MOCK } from "@/lib/content";

/*
 * The product, rebuilt in HTML instead of screenshots.
 *
 * Three screens from the real app — the post approve card, the review
 * inbox, the performance block — drawn with the same markup discipline
 * as the rest of the landing page. Everything shown is sample data
 * (the proof section says so out loud), and every behaviour depicted
 * is real: posts are drafts until approved, four-star-and-up reviews
 * answer themselves, complaints wait for the owner.
 *
 * Each mock is frameless; the parent supplies the border and rounding
 * so it can sit in a phone-ish column (how.tsx) or a card (proof.tsx).
 */

const M = APP_MOCK;

function Header() {
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--l-line)] px-4 py-3">
      <span
        aria-hidden
        className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[#2563eb] text-[13px] font-bold text-white"
      >
        {M.business.initial}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-bold leading-tight">
          {M.business.name}
        </span>
        <span className="block text-[11px] leading-tight text-[var(--l-muted)]">
          {M.business.meta}
        </span>
      </span>
    </div>
  );
}

function TabBar({ active }: { active: string }) {
  return (
    <div className="flex border-t border-[var(--l-line)] px-2 py-2.5">
      {M.tabs.map((t) => (
        <span
          key={t}
          className={`flex-1 text-center text-[11px] ${
            t === active
              ? "font-bold text-[var(--l-ink)]"
              : "text-[var(--l-muted)]"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5 stars`} className="text-[13px] leading-none">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? "#f59e0b" : "#d1d5db" }}>
          ★
        </span>
      ))}
    </span>
  );
}

/** /app/posts — one drafted post, waiting for its one-tap approve. */
export function AppPostsMock() {
  return (
    <div className="bg-white text-left">
      <Header />
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">{M.post.label}</p>
          <span className="l-pill bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-semibold text-[#b45309]">
            {M.post.status}
          </span>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-xl">
          <Image
            src="/marketing/owner-portrait.webp"
            alt=""
            width={800}
            height={597}
            className="h-40 w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-[15px] font-bold leading-snug text-white">
              {M.post.headline}
            </p>
            <p className="mt-1 text-[10px] text-white/70">{M.business.name}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[var(--l-muted)]">
          {M.post.photoNote}
        </p>

        <p className="mt-3 text-[14px] leading-relaxed text-[var(--l-ink-2)]">
          {M.post.body}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-full bg-[var(--l-ink)] px-5 text-[13px] font-semibold text-white">
            {M.post.approve}
          </span>
          <span className="inline-flex h-9 items-center rounded-full border border-[var(--l-line)] px-5 text-[13px] font-semibold text-[var(--l-ink)]">
            {M.post.edit}
          </span>
          <span className="ml-auto text-[13px] text-[var(--l-muted)]">
            {M.post.remove}
          </span>
        </div>

        <p className="mt-4 border-t border-[var(--l-line)] pt-3 text-[12px] text-[var(--l-muted)]">
          {M.post.footer}
        </p>
      </div>
      <TabBar active="Posts" />
    </div>
  );
}

function Review({
  r,
  held,
}: {
  r: typeof M.reviews.replied;
  held?: boolean;
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-8 w-8 flex-none place-items-center rounded-full text-[13px] font-bold text-white"
          style={{ backgroundColor: r.color }}
        >
          {r.initial}
        </span>
        <span>
          <span className="block text-[13px] font-bold leading-tight">
            {r.name}
          </span>
          <span className="flex items-center gap-1.5 leading-tight">
            <Stars n={r.stars} />
            <span className="text-[11px] text-[var(--l-muted)]">{r.when}</span>
          </span>
        </span>
      </div>

      <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--l-ink-2)]">
        {r.text}
      </p>

      <div className="mt-2.5 rounded-xl bg-[var(--l-wash)] px-3.5 py-3">
        <p
          className={`text-[10px] font-semibold uppercase tracking-wide ${
            held ? "text-[#b45309]" : "text-[var(--l-muted)]"
          }`}
        >
          {r.replyLabel}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--l-ink-2)]">
          {r.reply}
        </p>
      </div>

      {held ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex h-8 items-center rounded-full bg-[var(--l-ink)] px-4 text-[12px] font-semibold text-white">
            approve
          </span>
          <span className="inline-flex h-8 items-center rounded-full border border-[var(--l-line)] px-4 text-[12px] font-semibold text-[var(--l-ink)]">
            edit
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** /app/reviews — a published auto-reply, and a complaint held for the owner. */
export function AppReviewsMock() {
  return (
    <div className="bg-white text-left">
      <Header />
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="text-[13px] font-semibold">{M.reviews.title}</p>
        <span className="l-pill bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-semibold text-[#b45309]">
          {M.reviews.pill}
        </span>
      </div>
      <Review r={M.reviews.held} held />
      <div aria-hidden className="mx-4 border-t border-[var(--l-line)]" />
      <Review r={M.reviews.replied} />
    </div>
  );
}

/** /app/performance — the numbers block: views, calls, directions. */
export function AppPerformanceMock() {
  const max = Math.max(...M.performance.bars);
  return (
    <div className="bg-white text-left">
      <Header />
      <div className="px-4 py-4">
        <div className="flex rounded-full bg-[var(--l-wash-2)] p-1">
          {M.performance.ranges.map((r, i) => (
            <span
              key={r}
              className={`flex-1 rounded-full py-1.5 text-center text-[12px] ${
                i === 0
                  ? "bg-white font-semibold shadow-sm"
                  : "text-[var(--l-muted)]"
              }`}
            >
              {r}
            </span>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {M.performance.stats.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-xl border px-3 py-2.5 ${
                i === 0
                  ? "border-[#bfdbfe] bg-[#eff6ff]"
                  : "border-[var(--l-line)]"
              }`}
            >
              <p
                className={`text-[11px] font-medium ${
                  i === 0 ? "text-[#2563eb]" : "text-[var(--l-muted)]"
                }`}
              >
                {s.label}
              </p>
              <p className="mt-0.5 text-xl font-bold tracking-tight">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-[var(--l-muted)]">
          {M.performance.chartLabel}
        </p>
        <div aria-hidden className="mt-2 flex h-24 items-end gap-1">
          {M.performance.bars.map((b, i) => (
            <span
              key={i}
              className="flex-1 rounded-t bg-[#818cf8]"
              style={{ height: `${Math.round((b / max) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-[var(--l-muted)]">
          {M.performance.axis.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>

        <p className="mt-4 border-t border-[var(--l-line)] pt-3 text-[12px] text-[var(--l-muted)]">
          {M.performance.footer}
        </p>
      </div>
    </div>
  );
}
