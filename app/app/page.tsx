"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";

export default function HomePage() {
  const data = useQuery(api.dashboard.home);
  const addCustomer = useMutation(api.dashboard.addCustomer);
  const refresh = useAction(api.google.refreshLocation);

  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, reviews, posts, photos, customers, actions, metrics } = data;
  const digits = phone.replace(/\D/g, "");

  async function sendReviewLink() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await addCustomer({ phone: digits });

      if (business.reviewUri) {
        const text = `Thanks for visiting ${business.orgName}! If we did a good job, would you leave us a quick Google review? It takes 30 seconds: ${business.reviewUri}`;
        window.open(
          `https://wa.me/91${digits.slice(-10)}?text=${encodeURIComponent(text)}`,
          "_blank",
        );
        setNote("WhatsApp opened — press send.");
      } else {
        setNote(
          "Saved. We don't have your Google review link yet — tap “refresh listing” below.",
        );
      }
      setPhone("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refreshListing() {
    setBusy(true);
    setError(null);
    try {
      await refresh({});
      setNote("Listing refreshed from Google.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const reviewPct = Math.min(
    100,
    Math.round((reviews.thisWeek / reviews.target) * 100),
  );

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      {/* ---------------------------- reviews ---------------------------- */}
      <section
        className={`rounded-[14px] border p-4 ${
          reviews.thisWeek > 0
            ? "border-open bg-open-soft"
            : "border-pin bg-pin-soft"
        }`}
      >
        <p className="font-mono text-[11px] text-ink-soft">This week&rsquo;s reviews</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="font-display text-[17px] font-bold leading-tight">
            {reviews.thisWeek > 0
              ? `${reviews.thisWeek} new this week`
              : "No reviews yet this week"}
          </p>
          <p className="flex-none font-display text-[17px] font-bold">
            <span className={reviews.thisWeek > 0 ? "text-open" : "text-pin"}>
              {reviews.thisWeek}
            </span>
            <span className="text-muted">/{reviews.target}</span>
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2">
          <div
            className={`h-full rounded-full transition-all ${
              reviews.thisWeek > 0 ? "bg-open" : "bg-pin/30"
            }`}
            style={{ width: `${Math.max(reviewPct, 3)}%` }}
          />
        </div>

        <p className="mt-3 text-[13px] leading-snug text-ink-soft">
          {reviews.daysSinceLastReview === null
            ? "We haven't seen a review come in yet. Reviews are the strongest thing you can move for Google ranking."
            : `Your last review was ${reviews.daysSinceLastReview} days ago. Reviews are vital for good Google ranking.`}
        </p>

        <div className="mt-4 flex items-center justify-between gap-1 border-t border-rule-soft pt-3 text-center">
          {["More customers", "More reviews", "Better ranking"].map((step, i) => (
            <div key={step} className="flex flex-1 items-center gap-1">
              <span className="flex-1 font-mono text-[9px] uppercase tracking-wide text-muted">
                {step}
              </span>
              {i < 2 ? (
                <span aria-hidden className="text-open">
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------ review collection ---------------------- */}
      <section className="mt-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (digits.length >= 10 && !busy) void sendReviewLink();
          }}
        >
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 12))}
            placeholder="Customer phone number"
            className="min-w-0 flex-1 rounded-[12px] border border-ink bg-paper-2 px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/50"
          />
          <a
            href={business.reviewUri ?? "#"}
            target="_blank"
            rel="noreferrer"
            aria-label="open your review link"
            className="grid w-12 flex-none place-items-center rounded-[12px] border border-ink bg-paper-2 text-[18px]"
          >
            ▦
          </a>
        </form>

        <button
          type="button"
          onClick={() => void sendReviewLink()}
          disabled={digits.length < 10 || busy}
          className="btn btn-primary mt-3 w-full disabled:opacity-40"
        >
          {busy ? "working…" : "send review link"}
        </button>

        {note ? (
          <p className="mt-3 rounded-[12px] border border-open bg-open-soft px-3.5 py-2.5 text-[13px] leading-snug">
            {note}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-[12px] border border-pin bg-pin-soft px-3.5 py-2.5 text-[13px] leading-snug"
          >
            {error}
          </p>
        ) : null}

        {!business.reviewUri ? (
          <button
            type="button"
            onClick={() => void refreshListing()}
            disabled={busy}
            className="mt-3 font-mono text-[11px] underline underline-offset-4 hover:text-pin"
          >
            refresh listing from google
          </button>
        ) : null}
      </section>

      {/* --------------------------- agent state ------------------------- */}
      <section className="mt-6 rounded-[14px] border border-ink bg-paper-2 shadow-[3px_4px_0_var(--color-ink)]">
        <div className="flex items-center justify-between gap-3 border-b border-rule-soft px-4 py-3">
          <p className="flex items-center gap-2 font-display text-[15px] font-bold">
            <span aria-hidden className="text-pin">
              ✦
            </span>
            GBP AI agent
          </p>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] ${
              business.agentActive
                ? "border-open bg-open-soft text-open"
                : "border-rule text-muted"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                business.agentActive ? "bg-open" : "bg-muted"
              }`}
            />
            {business.agentActive ? "Active" : "Paused"}
          </span>
        </div>

        <ul className="divide-y divide-rule-soft">
          <Counter
            href="/app/posts"
            label={`${posts.published} posts published`}
            detail={
              posts.scheduled
                ? `${posts.scheduled} scheduled`
                : "nothing scheduled yet"
            }
          />
          <Counter
            href="/app/photos"
            label={`${photos.published} photos published`}
            detail={
              photos.inBucket
                ? `${photos.inBucket} waiting in your photo bucket`
                : "no photos uploaded yet"
            }
          />
          <Counter
            href="/app/reviews"
            label={`${reviews.total} reviews`}
            detail={
              reviews.total === 0
                ? "none pulled from Google yet"
                : `${reviews.repliedPercent}% replied · ${reviews.awaitingReply} waiting`
            }
          />
          <Counter
            href="/app/performance"
            label="Performance"
            detail={
              metrics
                ? `${metrics.views} views in the last ${metrics.days} days`
                : "no data pulled from Google yet"
            }
          />
        </ul>
      </section>

      {/* ---------------------------- timeline --------------------------- */}
      <section className="mt-6">
        <h2 className="font-display text-[15px] font-bold">
          Google Business Profile
        </h2>
        <ol className="mt-3 space-y-0">
          {[
            { label: "Profile connected", done: !!business.gbpLocationName },
            { label: "Business analysed", done: business.onboardingStep >= 4 },
            { label: "Setup complete", done: business.onboardingComplete },
            {
              label: "Optimisations running",
              done: business.agentActive && posts.published > 0,
            },
            { label: "Ranking tracked", done: (data.keywordCount ?? 0) > 0 },
          ].map((step, i, all) => (
            <li key={step.label} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                    step.done
                      ? "border-open bg-open text-paper-2"
                      : "border-rule text-transparent"
                  }`}
                >
                  ✓
                </span>
                {i < all.length - 1 ? (
                  <span
                    aria-hidden
                    className="w-px flex-1 border-l border-dashed border-rule"
                  />
                ) : null}
              </span>
              <span
                className={`pb-4 text-[14px] ${
                  step.done ? "text-ink" : "text-muted"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------- actions --------------------------- */}
      <section className="mt-2">
        <h2 className="font-display text-[15px] font-bold">What we&rsquo;ve done</h2>

        {actions.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-6 text-center text-[13px] leading-relaxed text-muted">
            Nothing yet. The first post goes out once setup is finished.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {actions.map((action) => (
              <li
                key={action._id}
                className="rounded-[14px] border border-rule bg-paper-2 p-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-ink bg-paper px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider">
                    {action.type.replace("_", " ")}
                  </span>
                  <span className="flex-none font-mono text-[10px] text-muted">
                    {new Date(action.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="mt-2 text-[14px] font-semibold leading-snug">
                  {action.title}
                </p>
                {action.detail ? (
                  <p className="mt-1 text-[13px] leading-snug text-ink-soft">
                    {action.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {customers.total > 0 ? (
        <p className="mt-6 text-center font-mono text-[11px] text-muted">
          {customers.total} customers saved · {customers.linksSent} review links sent
        </p>
      ) : null}
    </AppScreen>
  );
}

function Counter({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <li>
      <a href={href} className="flex items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-tight">
            {label}
          </span>
          <span className="mt-0.5 block text-[12px] text-muted">{detail}</span>
        </span>
        <span aria-hidden className="flex-none text-muted">
          ›
        </span>
      </a>
    </li>
  );
}
