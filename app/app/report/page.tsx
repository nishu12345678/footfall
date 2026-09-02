"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PRICING } from "@/lib/content";
import { shopHost, shopUrl } from "@/lib/site-host";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const TONE = {
  critical: {
    ring: "border-pin",
    chip: "bg-pin text-white",
    label: "Fix this",
    mark: "!",
  },
  warn: {
    ring: "border-star",
    chip: "bg-star text-white",
    label: "Worth doing",
    mark: "•",
  },
  good: {
    ring: "border-open",
    chip: "bg-open text-white",
    label: "Already good",
    mark: "✓",
  },
} as const;

export default function ReportPage() {
  const report = useQuery(api.audit.report);
  const checkWebsite = useAction(api.audit.checkWebsite);
  const generateSite = useAction(api.site.generateSite);
  const refresh = useAction(api.audit.refresh);
  const [reading, setReading] = useState(false);
  const asked = useRef(false);
  const [checking, setChecking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /* Read the live listing before showing anything. Reporting on empty
     tables told a shop that had posted for years that it had never posted
     — the one kind of wrong a free report cannot afford to be. */
  useEffect(() => {
    if (!report || !report.connected || report.listingSyncedAt) return;
    if (asked.current) return;
    asked.current = true;
    setReading(true);
    refresh({}).finally(() => setReading(false));
  }, [report, refresh]);

  const readNow = async () => {
    setReading(true);
    setNote(null);
    try {
      await refresh({});
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  if (report === undefined) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="text-[16px] text-muted">Reading your listing…</p>
      </main>
    );
  }

  if (report === null) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="text-[16px] text-muted">Please sign in.</p>
      </main>
    );
  }

  if (!report.connected) {
    return (
      <main className="mx-auto max-w-md px-5 py-14">
        <h1 className="text-[1.9rem]">Connect your Google profile</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
          One Google login and we&rsquo;ll read your listing and tell you
          exactly what is holding it back. Free, and it takes about 40
          seconds. Nothing is published and nothing changes.
        </p>
        <a href="/app/connect" className="btn btn-primary mt-7 w-full">
          Connect Google Business Profile
        </a>
      </main>
    );
  }

  if (!report.listingSyncedAt) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-[19px] font-semibold">
          Reading your Google listing…
        </p>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          We&rsquo;re pulling your real posts, photos and reviews from Google.
          This takes a few seconds the first time.
        </p>
        {!reading ? (
          <button
            type="button"
            onClick={readNow}
            className="btn btn-primary mt-7 w-full"
          >
            Try again
          </button>
        ) : null}
      </main>
    );
  }

  const critical = report.findings.filter((f) => f.severity === "critical");
  const yearly = PRICING.plans.find((p) => p.id === "yearly");

  const build = async () => {
    setBuilding(true);
    setNote(null);
    try {
      const r = await generateSite({});
      setBuilt(r.slug);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBuilding(false);
    }
  };

  const runCheck = async () => {
    setChecking(true);
    setNote(null);
    try {
      const r = await checkWebsite({});
      setNote(
        r.ok
          ? "Checked. Pull down to refresh if it hasn't updated."
          : r.reason === "no website"
            ? "You don't have a website on your listing yet."
            : "We couldn't read the site just now.",
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <p className="text-[14px] font-bold uppercase tracking-wider text-pin">
        Free listing report
      </p>
      <h1 className="mt-2 text-[1.8rem]">{report.business.name}</h1>
      <p className="mt-1 text-[16px] text-muted">
        {[report.business.category, report.business.city]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* The headline number. Blunt on purpose — this is the reason to pay. */}
      <section className="card mt-7 p-6">
        <p className="text-[17px] leading-relaxed">
          We found{" "}
          <strong className="text-pin">
            {critical.length} thing{critical.length === 1 ? "" : "s"} costing
            you customers
          </strong>{" "}
          right now.
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-rule-soft pt-5">
          {[
            ["Photos", report.counts.photos],
            ["Reviews", report.counts.reviews],
            ["Unanswered", report.counts.unansweredReviews],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-[13px] uppercase tracking-wider text-muted">
                {label}
              </dt>
              <dd className="mt-1 text-[1.6rem] font-extrabold leading-none">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          Read from Google on {fmtDate(report.listingSyncedAt)}
        </p>
        <button
          type="button"
          onClick={readNow}
          disabled={reading}
          className="text-[14px] font-semibold text-pin underline underline-offset-4 disabled:opacity-60"
        >
          {reading ? "Reading…" : "Refresh"}
        </button>
      </div>

      <ul className="mt-6 grid gap-3">
        {report.findings.map((f) => {
          const tone = TONE[f.severity];
          return (
            <li
              key={f.id}
              className={`rounded-[16px] border-l-4 bg-white p-5 shadow-card ${tone.ring}`}
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${tone.chip}`}
              >
                <span aria-hidden>{tone.mark}</span>
                {tone.label}
              </span>
              <h2 className="mt-3 text-[18px] font-bold leading-snug">
                {f.title}
              </h2>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
                {f.detail}
              </p>
              <p className="mt-3 border-t border-rule-soft pt-3 text-[15px] leading-relaxed text-ink">
                <span className="font-semibold text-open">On a plan: </span>
                {f.fix}
              </p>
            </li>
          );
        })}
      </ul>

      {/* The website is the one check that costs an outside call, so it is
          run on request rather than on every page load. */}
      {report.business.website ? (
        <button
          type="button"
          onClick={runCheck}
          disabled={checking}
          className="btn btn-ghost mt-5 w-full disabled:opacity-60"
        >
          {checking
            ? "Reading your website…"
            : report.websiteCheckedAt
              ? "Check my website again"
              : "Check my website too"}
        </button>
      ) : (
        <section className="card mt-5 p-5">
          <h2 className="text-[18px] font-bold">You have no website</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
            We can build you one right now from your Google listing — your
            services, your area, your hours, and the words people search.
            It is free, it is hosted, and there is nothing for you to
            maintain.
          </p>
          {built ? (
            <p className="mt-4 rounded-xl bg-open-soft p-4 text-[16px] leading-relaxed">
              Your website is live at{" "}
              <a
                href={shopUrl(built)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-open underline underline-offset-4"
              >
                {shopHost(built)}
              </a>
            </p>
          ) : (
            <button
              type="button"
              onClick={build}
              disabled={building}
              className="btn btn-primary mt-4 w-full disabled:opacity-60"
            >
              {building ? "Building your website…" : "Build my free website"}
            </button>
          )}
        </section>
      )}

      {note ? (
        <p className="mt-3 text-center text-[15px] text-muted">{note}</p>
      ) : null}

      {!report.paid ? (
        <section className="mt-10 rounded-[16px] bg-pin p-7 text-white shadow-lift">
          <h2 className="text-[1.5rem] text-white">
            This is the list. We can do all of it.
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-white/85">
            Everything above, fixed and kept fixed — posts every week, every
            review answered, new reviews collected, enquiries picked up at 11
            PM, and the pages that catch the searches your listing cannot.
          </p>
          {yearly ? (
            <p className="mt-4 text-[17px] text-white/85">
              From{" "}
              <strong className="text-white">{inr(yearly.perMonth)}</strong> a
              month.
            </p>
          ) : null}
          <a
            href="/app/billing"
            className="btn mt-6 w-full border-white bg-white text-pin hover:bg-white/90"
          >
            See the plans
          </a>
          <p className="mt-3 text-center text-[14px] text-white/60">
            Your report stays free either way.
          </p>
        </section>
      ) : null}
    </main>
  );
}
