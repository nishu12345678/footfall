"use client";

import Link from "next/link";
import { useQuery, usePaginatedQuery } from "convex/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { api } from "@/convex/_generated/api";
import {
  AdminShell,
  Empty,
  Panel,
  Pill,
  Skeleton,
  Stat,
  Truncated,
} from "@/components/admin-shell";
import { AdminErrorBoundary } from "@/components/admin-error-boundary";

/* ---------------------------------------------------------------------------
   The internal analytics dashboard.

   Everything on this page is read from Convex, which docs/product-analytics.md
   names as the ledger: activation, product use and revenue are
   server-confirmed facts, not browser claims. GA is not consulted here at
   all and must never be — it is a marketing-attribution copy that an ad
   blocker can silently halve.

   Three rules the rendering keeps, because a dashboard that breaks them is
   worse than no dashboard:

   1. A capped read says so. Every `truncated` flag the backend returns is
      rendered as a visible "lower bound, not a total" warning.
   2. A monthly run rate is labelled a run rate. Nothing here auto-debits,
      so calling it MRR would be a lie told to ourselves.
   3. Identity is whatever the backend chose to mask. This file never
      un-masks, never joins two masked fields to re-identify, and never
      shows a Convex document id as if it were a customer reference.
--------------------------------------------------------------------------- */

const WINDOWS = [7, 30, 90] as const;
type Window = (typeof WINDOWS)[number];

const PAGE_SIZE = 25;

/* ------------------------------- formatting ------------------------------ */

const num = (n: number) => n.toLocaleString("en-IN");

/** Paise in, rupees out. The backend stores money as integer paise. */
const inr = (paise: number) =>
  `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/** Rupees with paise, for the run rate where rounding is visible. */
const inrExact = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const pct = (share: number | null) =>
  share === null ? "—" : `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%`;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "2026-02-17" -> "17 Feb". The backend's day key is already IST. */
function shortDay(day: string) {
  const [, m, d] = day.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${Number(d)} ${months[Number(m) - 1] ?? ""}`.trim();
}

/** How long ago, in the roughest honest unit. */
function ago(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const EVENT_LABEL: Record<string, string> = {
  account_created: "Account created",
  gbp_connect_started: "Google connect started",
  gbp_connect_failed: "Google connect failed",
  business_connected: "Business connected",
  business_reconnected: "Business reconnected",
  onboarding_step_completed: "Onboarding step",
  onboarding_completed: "Onboarding completed",
  audit_completed: "Audit completed",
  content_generated: "Content generated",
  content_published: "Content published",
  site_published: "Site published",
  checkout_started: "Checkout started",
  checkout_failed: "Checkout failed",
  checkout_dismissed: "Checkout dismissed",
  payment_succeeded: "Payment captured",
  payment_refunded: "Payment refunded",
};

const FAILURE_EVENTS = new Set([
  "gbp_connect_failed",
  "checkout_failed",
  "payment_refunded",
]);

/* ------------------------------- the clock -------------------------------
   `now` is an argument to every query here rather than a Date.now() read
   inside them, and the backend says why: a Convex query that reads the
   wall clock is not re-run when time passes, so its cached result goes
   quietly stale. The browser therefore owns the instant.

   It has to be a PINNED instant, not a fresh read per render. A new
   Date.now() on every render would be a new set of query arguments on
   every render — a new cache entry and a new subscription each time — and
   a value computed during render would differ between the server pass and
   hydration.

   The wall clock is an external system, so it is modelled as one:
   useSyncExternalStore gives null on the server and during hydration (no
   mismatch), then the pinned instant. `refresh` re-pins it and tells every
   subscriber, which is what the Refresh button does. */

let pinned: number | null = null;
const clockListeners = new Set<() => void>();

function subscribeClock(fn: () => void) {
  clockListeners.add(fn);
  // Pin on first subscribe, which happens after hydration.
  if (pinned === null) pinned = Date.now();
  return () => void clockListeners.delete(fn);
}

function refreshClock() {
  pinned = Date.now();
  for (const fn of clockListeners) fn();
}

function usePinnedNow(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => pinned,
    () => null,
  );
}

/* ================================== page ================================= */

export default function AdminAnalyticsPage() {
  const me = useQuery(api.adminDash.me);

  const now = usePinnedNow();
  const [days, setDays] = useState<Window>(30);

  if (me === undefined) {
    return (
      <AdminShell title="Analytics">
        <Skeleton rows={4} />
      </AdminShell>
    );
  }

  /* Signed out, or signed in without the allowlisted verified email.
   *
   * Both land here and both are told the same thing, for the same reason
   * the backend answers "Not found." — a route that says "you are not an
   * admin" has confirmed that an admin area exists at this address.
   * proxy.ts already redirects a signed-out visitor to the login page, so
   * in practice this is the second case. */
  if (!me.signedIn || !me.isAdmin) return <NotFound />;

  return (
    <AdminShell
      title="Analytics"
      subtitle={
        <>
          Convex is the source of truth for activation, product use and
          revenue. GA measures anonymous acquisition only and is not read
          here.
        </>
      }
      actions={
        <>
          <WindowPicker days={days} onChange={setDays} />
          <button type="button" onClick={refreshClock} className="btn btn-ghost btn-sm">
            Refresh
          </button>
        </>
      }
    >
      {now === null ? (
        <Skeleton rows={4} />
      ) : (
        <div className="space-y-6">
          <AdminErrorBoundary>
            <Overview days={days} now={now} />
          </AdminErrorBoundary>
          <AdminErrorBoundary>
            <Businesses now={now} />
          </AdminErrorBoundary>
          <AdminErrorBoundary>
            <Feed now={now} />
          </AdminErrorBoundary>
        </div>
      )}
    </AdminShell>
  );
}

/* ------------------------------- denied ---------------------------------- */

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="card p-6">
        <h1 className="text-[1.6rem]">Not found</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          There is nothing at this address.
        </p>
        <Link href="/app" className="btn btn-primary btn-sm mt-6 w-full">
          Go to the app
        </Link>
      </div>
    </main>
  );
}

/* ---------------------------- window selector ---------------------------- */

function WindowPicker({
  days,
  onChange,
}: {
  days: Window;
  onChange: (d: Window) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Reporting window"
      className="inline-flex rounded-full bg-black/5 p-1"
    >
      {WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          aria-pressed={days === w}
          className={`min-h-8 rounded-full px-3.5 py-1 text-[13px] font-semibold transition-colors ${
            days === w ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"
          }`}
        >
          {w}d
        </button>
      ))}
    </div>
  );
}

/* ================================ overview =============================== */

function Overview({ days, now }: { days: Window; now: number }) {
  const data = useQuery(api.adminDash.overview, { days, now });

  if (data === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-[104px] animate-pulse bg-white" />
          ))}
        </div>
        <Panel title="Funnel">
          <Skeleton rows={7} />
        </Panel>
      </div>
    );
  }

  // Keyed by the plain string, not the generated event union: the lookups
  // below are written out by hand and read better as literals than as
  // imports of a backend type.
  const lifetime = new Map<string, EventTotal>(
    data.events.map((e) => [e.event, e]),
  );
  const get = (event: string) => lifetime.get(event);

  return (
    <div className="space-y-6">
      {/* ----------------------------- summary ---------------------------- */}
      <section aria-label="Summary">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Accounts"
            value={num(get("account_created")?.lifetimeCount ?? 0)}
            hint={`${num(get("account_created")?.windowCount ?? 0)} in ${days}d`}
          />
          <Stat
            label="Businesses connected"
            value={num(get("business_connected")?.lifetimeCount ?? 0)}
            hint={`${num(get("business_connected")?.windowCount ?? 0)} in ${days}d`}
          />
          <Stat
            label="Active plans"
            value={num(data.plans.activePlans)}
            tone={data.plans.activePlans > 0 ? "good" : "normal"}
            hint={`${num(data.plans.activeMonthly)} monthly · ${num(
              data.plans.activeYearly,
            )} yearly${
              data.plans.activeComp > 0
                ? ` · ${num(data.plans.activeComp)} comped`
                : ""
            }`}
          />
          <Stat
            label="Monthly run rate"
            value={inrExact(data.plans.monthlyRunRatePaise)}
            hint="Not MRR — nothing auto-debits. Monthly amounts plus yearly ÷ 12."
          />
          <Stat
            label="Captured revenue"
            value={inr(data.revenue.capturedLifetimePaise)}
            hint={`${inr(data.revenue.capturedWindowPaise)} in ${days}d`}
          />
          <Stat
            label="Refunded"
            value={inr(data.revenue.refundedLifetimePaise)}
            tone={data.revenue.refundedLifetimePaise > 0 ? "warn" : "normal"}
            hint={`Net ${inr(data.revenue.netLifetimePaise)} lifetime`}
          />
          <Stat
            label={`First value · ${days}d`}
            value={num(data.firstValue.businessesInWindow)}
            hint="Distinct businesses with a successful publish."
          />
          <Stat
            label="Published"
            value={num(get("content_published")?.lifetimeCount ?? 0)}
            hint={`${num(get("content_published")?.windowCount ?? 0)} in ${days}d`}
          />
        </div>

        {(data.plans.truncated || data.firstValue.truncated) && (
          <div className="mt-3 space-y-2">
            {data.plans.truncated ? (
              <Truncated
                what={`The plan and run-rate read (${num(
                  data.plans.rowsRead,
                )} subscription rows)`}
              />
            ) : null}
            {data.firstValue.truncated ? (
              <Truncated what="The distinct first-value count" />
            ) : null}
          </div>
        )}
      </section>

      {/* ------------------------------ funnel ---------------------------- */}
      <Funnel steps={data.funnel} days={days} />

      {/* ------------------------------ trend ----------------------------- */}
      <Trend points={data.trend} days={days} fromDay={data.fromDay} toDay={data.toDay} />

      {/* -------------------------- revenue + plans ----------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Revenue revenue={data.revenue} plans={data.plans} days={days} />
        <Plans plans={data.plans} />
      </div>

      {/* ------------------------- every event total ---------------------- */}
      <EventTotals events={data.events} days={days} />
    </div>
  );
}

/* -------------------------------- funnel --------------------------------- */

type FunnelStep = {
  event: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
  droppedFromPrevious: number | null;
  conversionFromStart: number | null;
};

function Funnel({ steps, days }: { steps: FunnelStep[]; days: Window }) {
  const top = steps[0]?.count ?? 0;
  const empty = steps.every((s) => s.count === 0);

  /* The worst drop-off, called out rather than left to be spotted. The
     first step has no previous, so it cannot be the answer. */
  const worst = useMemo(() => {
    let found: FunnelStep | null = null;
    for (const s of steps) {
      if (s.conversionFromPrevious === null) continue;
      if ((s.droppedFromPrevious ?? 0) <= 0) continue;
      if (!found || s.conversionFromPrevious < (found.conversionFromPrevious ?? 1)) {
        found = s;
      }
    }
    return found;
  }, [steps]);

  return (
    <Panel
      title={`Funnel · last ${days} days`}
      note={
        <>
          Payment sits before the remaining onboarding steps because the paid
          mutations protect onboarding — an owner cannot finish setup without
          paying. Each row is events in the window, not a cohort followed
          through time.
        </>
      }
    >
      {empty ? (
        <Empty>No events in this window yet.</Empty>
      ) : (
        <>
          <ol className="divide-y divide-rule-soft">
            {steps.map((step, i) => {
              const width = top > 0 ? Math.max(2, (step.count / top) * 100) : 2;
              const lost = step.droppedFromPrevious ?? 0;
              return (
                <li key={step.event} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[14px] font-semibold">
                      <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                      {step.label}
                    </p>
                    <p className="flex items-baseline gap-3 text-[13px] tabular-nums">
                      <span className="text-[16px] font-bold">{num(step.count)}</span>
                      {step.conversionFromPrevious !== null ? (
                        <span
                          className={
                            step.conversionFromPrevious < 0.3
                              ? "font-semibold text-alert"
                              : "text-ink-soft"
                          }
                        >
                          {pct(step.conversionFromPrevious)} of previous
                        </span>
                      ) : null}
                      {step.conversionFromStart !== null ? (
                        <span className="text-muted">
                          {pct(step.conversionFromStart)} of start
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-paper-3"
                    role="img"
                    aria-label={`${step.label}: ${num(step.count)}${
                      step.conversionFromPrevious !== null
                        ? `, ${pct(step.conversionFromPrevious)} of the previous step`
                        : ""
                    }`}
                  >
                    <div
                      className="h-full rounded-full bg-pin"
                      style={{ width: `${width}%` }}
                    />
                  </div>

                  {lost > 0 ? (
                    <p className="mt-1.5 text-[12px] text-muted">
                      {num(lost)} lost here
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {worst ? (
            <p className="hairline-t px-5 py-3 text-[12px] leading-snug text-ink-soft">
              Biggest drop-off:{" "}
              <strong className="font-semibold">{worst.label}</strong> keeps{" "}
              {pct(worst.conversionFromPrevious)} of the step above and loses{" "}
              {num(worst.droppedFromPrevious ?? 0)}.
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/* --------------------------------- trend --------------------------------- */

type TrendPoint = {
  day: string;
  accountsCreated: number;
  businessesConnected: number;
  paymentsCaptured: number;
  revenuePaise: number;
  refundsPaise: number;
  contentPublished: number;
};

const SERIES = [
  { key: "accountsCreated", label: "Accounts", color: "bg-pin" },
  { key: "businessesConnected", label: "Connected", color: "bg-open" },
  { key: "paymentsCaptured", label: "Payments", color: "bg-star" },
] as const;

/**
 * Daily signups, connects, purchases and revenue.
 *
 * A stacked CSS bar per day rather than a charting library: three series
 * over at most ninety points does not justify a dependency, and a <table>
 * underneath makes the same numbers readable by a screen reader and
 * copyable into a spreadsheet — which is what actually happens with a
 * weekly scorecard.
 */
function Trend({
  points,
  days,
  fromDay,
  toDay,
}: {
  points: TrendPoint[];
  days: Window;
  fromDay: string;
  toDay: string;
}) {
  const [open, setOpen] = useState(false);

  const peak = Math.max(
    1,
    ...points.map(
      (p) => p.accountsCreated + p.businessesConnected + p.paymentsCaptured,
    ),
  );
  const peakRevenue = Math.max(1, ...points.map((p) => p.revenuePaise));
  const totalRevenue = points.reduce((s, p) => s + p.revenuePaise, 0);
  const anything = points.some(
    (p) =>
      p.accountsCreated + p.businessesConnected + p.paymentsCaptured > 0 ||
      p.revenuePaise > 0,
  );

  return (
    <Panel
      title={`Daily trend · ${shortDay(fromDay)} – ${shortDay(toDay)}`}
      note="IST calendar days, from the daily aggregate rows. Revenue is captured payments."
      actions={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="btn btn-ghost btn-sm"
        >
          {open ? "Hide table" : "Show table"}
        </button>
      }
    >
      {!anything ? (
        <Empty>Nothing happened in the last {days} days.</Empty>
      ) : (
        <>
          <div className="px-5 pt-4">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {SERIES.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-1.5 text-[12px] text-ink-soft"
                >
                  <span
                    aria-hidden
                    className={`inline-block h-2.5 w-2.5 rounded-[3px] ${s.color}`}
                  />
                  {s.label}
                </li>
              ))}
              <li className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-4 rounded-full bg-ink/30"
                />
                Revenue ({inr(totalRevenue)} total)
              </li>
            </ul>
          </div>

          {/* The bars scroll sideways on a phone rather than compressing
              ninety days into a smear. */}
          <div className="no-scrollbar overflow-x-auto px-5 py-4">
            <div
              className="flex h-[168px] min-w-full items-end gap-[3px]"
              style={{ minWidth: `${points.length * 12}px` }}
            >
              {points.map((p) => {
                const total =
                  p.accountsCreated + p.businessesConnected + p.paymentsCaptured;
                return (
                  <div
                    key={p.day}
                    className="group relative flex h-full min-w-[8px] flex-1 flex-col justify-end"
                    title={`${shortDay(p.day)} · ${p.accountsCreated} accounts · ${
                      p.businessesConnected
                    } connected · ${p.paymentsCaptured} payments · ${inr(
                      p.revenuePaise,
                    )}`}
                  >
                    {/* Revenue as a hairline marker on the same day column,
                        scaled to its own peak — mixing rupees and counts on
                        one axis would make both meaningless. */}
                    {p.revenuePaise > 0 ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-0 h-0.5 rounded-full bg-ink/30"
                        style={{
                          bottom: `${(p.revenuePaise / peakRevenue) * 96}%`,
                        }}
                      />
                    ) : null}

                    {total === 0 ? (
                      <span
                        aria-hidden
                        className="h-0.5 w-full rounded-full bg-paper-3"
                      />
                    ) : (
                      SERIES.map((s) => {
                        const value = p[s.key];
                        if (value === 0) return null;
                        return (
                          <span
                            key={s.key}
                            aria-hidden
                            className={`w-full ${s.color} first:rounded-t-[3px]`}
                            style={{ height: `${(value / peak) * 100}%` }}
                          />
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {open ? (
            <div className="hairline-t overflow-x-auto">
              <table className="w-full text-[13px] tabular-nums">
                <caption className="sr-only">
                  Daily accounts, connections, payments, revenue and publishes
                </caption>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted">
                    <th scope="col" className="px-5 py-2 font-bold">Day</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Accounts</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Connected</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Payments</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Revenue</th>
                    <th scope="col" className="px-3 py-2 text-right font-bold">Refunds</th>
                    <th scope="col" className="px-5 py-2 text-right font-bold">Published</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule-soft">
                  {[...points].reverse().map((p) => (
                    <tr key={p.day}>
                      <th scope="row" className="px-5 py-2 text-left font-medium">
                        {p.day}
                      </th>
                      <td className="px-3 py-2 text-right">{p.accountsCreated}</td>
                      <td className="px-3 py-2 text-right">{p.businessesConnected}</td>
                      <td className="px-3 py-2 text-right">{p.paymentsCaptured}</td>
                      <td className="px-3 py-2 text-right">{inr(p.revenuePaise)}</td>
                      <td className="px-3 py-2 text-right">
                        {p.refundsPaise > 0 ? (
                          <span className="text-alert">{inr(p.refundsPaise)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-2 text-right">{p.contentPublished}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/* -------------------------------- revenue -------------------------------- */

type RevenueBlock = {
  capturedLifetimePaise: number;
  refundedLifetimePaise: number;
  netLifetimePaise: number;
  capturedWindowPaise: number;
  refundedWindowPaise: number;
  netWindowPaise: number;
  currency: string;
};

type PlansBlock = {
  activePlans: number;
  activeMonthly: number;
  activeYearly: number;
  activeComp: number;
  monthlyRunRatePaise: number;
  truncated: boolean;
  rowsRead: number;
};

function Revenue({
  revenue,
  plans,
  days,
}: {
  revenue: RevenueBlock;
  plans: PlansBlock;
  days: Window;
}) {
  const rows: Array<[string, string, boolean?]> = [
    ["Captured", inr(revenue.capturedLifetimePaise)],
    ["Refunded", inr(revenue.refundedLifetimePaise), revenue.refundedLifetimePaise > 0],
    ["Net", inr(revenue.netLifetimePaise)],
    [`Captured · ${days}d`, inr(revenue.capturedWindowPaise)],
    [`Refunded · ${days}d`, inr(revenue.refundedWindowPaise), revenue.refundedWindowPaise > 0],
    [`Net · ${days}d`, inr(revenue.netWindowPaise)],
  ];

  return (
    <Panel
      title={`Revenue (${revenue.currency})`}
      note="Stored in paise, shown in rupees. Razorpay plus the Convex ledger is accounting truth; GA's copy is attribution only."
    >
      <dl className="divide-y divide-rule-soft">
        {rows.map(([label, value, warn]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 px-5 py-2.5"
          >
            <dt className="text-[13px] text-ink-soft">{label}</dt>
            <dd
              className={`text-[15px] font-semibold tabular-nums ${
                warn ? "text-alert" : ""
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 bg-paper-2/60 px-5 py-3">
          <dt className="text-[13px] font-semibold">Monthly run rate</dt>
          <dd className="text-[17px] font-extrabold tabular-nums">
            {inrExact(plans.monthlyRunRatePaise)}
          </dd>
        </div>
      </dl>
      <p className="hairline-t px-5 py-3 text-[12px] leading-relaxed text-muted">
        This product charges for a fixed period with no auto-debit, so the
        figure above is a <strong>monthly run rate</strong> — the monthly
        plan amounts plus the yearly amounts divided by twelve, for plans
        active right now — and not GAAP recurring revenue. Comped plans
        contribute nothing, because nothing was paid.
      </p>
      {plans.truncated ? (
        <div className="px-5 pb-4">
          <Truncated what="The subscription read behind the run rate" />
        </div>
      ) : null}
    </Panel>
  );
}

/* --------------------------------- plans --------------------------------- */

function Plans({ plans }: { plans: PlansBlock }) {
  const breakdown = [
    { label: "Monthly", value: plans.activeMonthly, color: "bg-pin" },
    { label: "Yearly", value: plans.activeYearly, color: "bg-open" },
    { label: "Comped", value: plans.activeComp, color: "bg-muted" },
  ];
  const total = plans.activePlans;

  return (
    <Panel
      title="Plans active now"
      note="From the subscription rows themselves, not from counting historical payment events — periods stack and a refund ends one early."
    >
      {total === 0 ? (
        <Empty>No plan is running right now.</Empty>
      ) : (
        <>
          <div className="px-5 pt-4">
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-paper-3"
              role="img"
              aria-label={breakdown
                .filter((b) => b.value > 0)
                .map((b) => `${b.label}: ${b.value}`)
                .join(", ")}
            >
              {breakdown.map((b) =>
                b.value > 0 ? (
                  <span
                    key={b.label}
                    className={b.color}
                    style={{ width: `${(b.value / total) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
          </div>
          <dl className="mt-1 divide-y divide-rule-soft">
            {breakdown.map((b) => (
              <div
                key={b.label}
                className="flex items-baseline justify-between gap-4 px-5 py-2.5"
              >
                <dt className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <span
                    aria-hidden
                    className={`inline-block h-2.5 w-2.5 rounded-[3px] ${b.color}`}
                  />
                  {b.label}
                </dt>
                <dd className="text-[15px] font-semibold tabular-nums">
                  {num(b.value)}{" "}
                  <span className="text-[12px] font-normal text-muted">
                    {pct(b.value / total)}
                  </span>
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 bg-paper-2/60 px-5 py-3">
              <dt className="text-[13px] font-semibold">Total</dt>
              <dd className="text-[17px] font-extrabold tabular-nums">
                {num(total)}
              </dd>
            </div>
          </dl>
        </>
      )}
      {plans.truncated ? (
        <div className="px-5 pb-4 pt-3">
          <Truncated what={`The plan read (${num(plans.rowsRead)} rows)`} />
        </div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------ event totals ----------------------------- */

type EventTotal = {
  event: string;
  windowCount: number;
  windowAmountPaise: number;
  lifetimeCount: number;
  lifetimeAmountPaise: number;
};

function EventTotals({ events, days }: { events: EventTotal[]; days: Window }) {
  const anything = events.some((e) => e.lifetimeCount > 0);
  return (
    <Panel
      title="Every event"
      note="The whole ledger by kind. Deduplicated at write time, so a webhook retry or a browser refresh cannot inflate a count."
    >
      {!anything ? (
        <Empty>The event ledger is empty.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="px-5 py-2.5 font-bold">Event</th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">
                  Last {days}d
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-bold">Lifetime</th>
                <th scope="col" className="px-5 py-2.5 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-soft">
              {events.map((e) => (
                <tr key={e.event} className={e.lifetimeCount === 0 ? "text-muted" : ""}>
                  <th scope="row" className="px-5 py-2 text-left font-medium">
                    {EVENT_LABEL[e.event] ?? e.event}
                    {FAILURE_EVENTS.has(e.event) && e.windowCount > 0 ? (
                      <span className="ml-2">
                        <Pill tone="warn">{num(e.windowCount)} in {days}d</Pill>
                      </span>
                    ) : null}
                  </th>
                  <td className="px-3 py-2 text-right">{num(e.windowCount)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {num(e.lifetimeCount)}
                  </td>
                  <td className="px-5 py-2 text-right">
                    {e.lifetimeAmountPaise > 0 ? inr(e.lifetimeAmountPaise) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ============================== businesses =============================== */

function Businesses({ now }: { now: number }) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.adminDash.businesses,
    { now },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <Panel
      title="Customers and businesses"
      note={
        <>
          Newest first. Contact identity is masked at the backend — enough to
          recognise the account a support email is about, useless in bulk.
          Nothing from Google tokens, customers, messages, reviews or post
          bodies is read by this query at all.
        </>
      }
      actions={
        results.length > 0 ? (
          <span className="text-[12px] text-muted tabular-nums">
            {num(results.length)} loaded
          </span>
        ) : null
      }
    >
      {status === "LoadingFirstPage" ? (
        <Skeleton rows={6} />
      ) : results.length === 0 ? (
        <Empty>No business has been connected yet.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <caption className="sr-only">
                Connected businesses with owner identity masked, onboarding,
                plan, first value and last activity
              </caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="px-5 py-2.5 font-bold">Business</th>
                  <th scope="col" className="px-3 py-2.5 font-bold">Owner</th>
                  <th scope="col" className="px-3 py-2.5 font-bold">Google</th>
                  <th scope="col" className="px-3 py-2.5 font-bold">Onboarding</th>
                  <th scope="col" className="px-3 py-2.5 font-bold">Plan</th>
                  <th scope="col" className="px-3 py-2.5 font-bold">First value</th>
                  <th scope="col" className="px-5 py-2.5 font-bold">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-soft">
                {results.map((b) => (
                  <tr key={b.businessId} className="align-top">
                    <th scope="row" className="px-5 py-3 text-left font-medium">
                      <span className="block max-w-[220px] truncate">{b.orgName}</span>
                      <span className="mt-0.5 block text-[12px] font-normal text-muted">
                        {b.city ?? "—"} · joined {fmtDate(b.createdAt)}
                      </span>
                    </th>

                    <td className="px-3 py-3">
                      <span className="block font-mono text-[12px]">
                        {b.ownerEmailMasked ?? "—"}
                      </span>
                      <span className="mt-0.5 block font-mono text-[12px] text-muted">
                        {b.ownerPhoneMasked ?? "—"}
                      </span>
                      <span className="mt-1 block">
                        {b.emailVerified ? (
                          <Pill tone="good">email verified</Pill>
                        ) : (
                          <Pill>email unverified</Pill>
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      {b.connected ? (
                        <Pill tone="good">connected</Pill>
                      ) : (
                        <Pill tone="warn">disconnected</Pill>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {b.onboardingComplete ? (
                        <Pill tone="good">complete</Pill>
                      ) : (
                        <Pill tone="info">step {b.onboardingStep} of 6</Pill>
                      )}
                      <span className="mt-1 block text-[12px] text-muted">
                        {b.agentActive
                          ? `agent on${
                              b.agentStartedAt
                                ? ` · ${fmtDate(b.agentStartedAt)}`
                                : ""
                            }`
                          : "agent off"}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      {b.planActive ? (
                        <>
                          <Pill tone="good">{b.plan ?? "active"}</Pill>
                          <span className="mt-1 block text-[12px] text-muted">
                            until{" "}
                            {b.planExpiresAt ? fmtDate(b.planExpiresAt) : "—"}
                          </span>
                        </>
                      ) : (
                        <Pill>none</Pill>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {b.firstValueAt ? (
                        <span className="text-ink-soft">
                          {fmtDate(b.firstValueAt)}
                        </span>
                      ) : (
                        <span className="text-muted">not yet</span>
                      )}
                    </td>

                    <td className="px-5 py-3">
                      {b.lastActivityAt ? (
                        <>
                          <span className="block text-ink-soft">
                            {ago(b.lastActivityAt, now)}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-muted">
                            {fmtDate(b.lastActivityAt)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">no events</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="hairline-t flex items-center justify-between gap-4 px-5 py-3">
            <p className="text-[12px] text-muted">
              {status === "Exhausted"
                ? "That is every business."
                : "A page at a time — each row does its own bounded lookups."}
            </p>
            {status !== "Exhausted" ? (
              <button
                type="button"
                onClick={() => loadMore(PAGE_SIZE)}
                disabled={isLoading || status !== "CanLoadMore"}
                className="btn btn-ghost btn-sm disabled:opacity-50"
              >
                {status === "LoadingMore" ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </div>
        </>
      )}
    </Panel>
  );
}

/* ================================= feed ================================== */

const FEED_FILTERS = [
  { value: "", label: "Everything" },
  { value: "account_created", label: "Accounts" },
  { value: "business_connected", label: "Connections" },
  { value: "checkout_started", label: "Checkouts" },
  { value: "payment_succeeded", label: "Payments" },
  { value: "content_published", label: "Publishes" },
  { value: "gbp_connect_failed", label: "Google failures" },
  { value: "checkout_failed", label: "Checkout failures" },
] as const;

type FeedFilter = (typeof FEED_FILTERS)[number]["value"];

function Feed({ now }: { now: number }) {
  const [filter, setFilter] = useState<FeedFilter>("");

  const data = useQuery(
    api.adminDash.recentEvents,
    filter === ""
      ? { limit: 100 }
      : // The backend validates this against its own event union; the
        // select above can only produce values from that union.
        { limit: 100, event: filter },
  );

  return (
    <Panel
      title="Recent events"
      note="Newest first, hard-capped. For debugging the funnel — the internal dedupe key is deliberately not returned, because it is an idempotency key and not a fact about a customer."
      actions={
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <span className="sr-only sm:not-sr-only">Filter</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FeedFilter)}
            className="min-h-8 rounded-full border border-rule bg-white px-3 py-1 text-[13px] font-medium text-ink outline-none focus:border-pin"
          >
            {FEED_FILTERS.map((f) => (
              <option key={f.value || "all"} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {data === undefined ? (
        <Skeleton rows={6} />
      ) : data.rows.length === 0 ? (
        <Empty>
          No events{filter ? " of this kind" : ""} yet.
        </Empty>
      ) : (
        <>
          <ul className="divide-y divide-rule-soft">
            {data.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-2.5 text-[13px]"
              >
                <span
                  className={`font-medium ${
                    FAILURE_EVENTS.has(row.event) ? "text-alert" : ""
                  }`}
                >
                  {EVENT_LABEL[row.event] ?? row.event}
                </span>
                <Pill
                  tone={
                    row.source === "owner"
                      ? "info"
                      : row.source === "backfill"
                        ? "neutral"
                        : "neutral"
                  }
                >
                  {row.source}
                </Pill>
                {row.amountPaise !== null && row.amountPaise > 0 ? (
                  <span className="font-semibold tabular-nums">
                    {inr(row.amountPaise)}
                    {row.currency && row.currency !== "INR"
                      ? ` ${row.currency}`
                      : ""}
                  </span>
                ) : null}
                {row.metadata ? <Metadata value={row.metadata} /> : null}
                <span className="ml-auto whitespace-nowrap text-[12px] text-muted tabular-nums">
                  {ago(row.occurredAt, now)} · {fmtTime(row.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
          {data.truncated ? (
            <div className="px-5 py-3">
              <Truncated what="This feed" />
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/**
 * The event's small non-PII metadata record: content kind, onboarding step,
 * plan, confirmation path, error class. Rendered as plain key=value rather
 * than JSON, and clipped, because the point is to recognise a shape at a
 * glance while debugging.
 */
function Metadata({
  value,
}: {
  value: Record<string, string | number | boolean>;
}) {
  const entries = Object.entries(value).slice(0, 4);
  if (entries.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted">
      {entries.map(([k, v]) => (
        <span key={k} className="max-w-[220px] truncate">
          {k}={String(v)}
        </span>
      ))}
    </span>
  );
}
