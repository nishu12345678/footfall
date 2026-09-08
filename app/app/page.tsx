"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { resumeHref, resumeLabel } from "@/lib/onboarding";
import { friendlyError } from "@/lib/errors";

export default function HomePage() {
  const data = useQuery(api.dashboard.home);
  const refresh = useAction(api.google.refreshLocation);

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, reviews, posts, photos, actions, metrics } = data;

  async function refreshListing() {
    setBusy(true);
    setError(null);
    try {
      await refresh({});
      setNote("Listing refreshed from Google.");
    } catch (e) {
      setError(friendlyError(e));
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
      {/* Setup isn't finished — say so, and offer the exact step they left. */}
      {!business.onboardingComplete ? (
        <Link
          href={resumeHref(business)}
          className="pressable mb-6 flex items-center gap-3 rounded-[14px] bg-star/15 p-5 shadow-card"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-tight">
              Your setup isn&rsquo;t finished
            </span>
            <span className="mt-0.5 block text-[13px] text-ink-soft">
              Step {business.onboardingStep} of 6 —{" "}
              {resumeLabel(business).replace("continue setup — ", "")}
            </span>
          </span>
          <span aria-hidden className="flex-none text-muted">
            ›
          </span>
        </Link>
      ) : null}

      {/* ---------------------------- reviews ---------------------------- */}
      <section
        className={`rounded-[18px] p-5 shadow-card ${
          reviews.thisWeek > 0 ? "bg-open-soft" : "bg-pin-soft"
        }`}
      >
        <p className="text-[13px] font-medium text-ink-soft">
          This week&rsquo;s reviews
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-[17px] font-semibold leading-tight">
            {reviews.thisWeek > 0
              ? `${reviews.thisWeek} new this week`
              : "No reviews yet this week"}
          </p>
          <p className="flex-none text-[17px] font-semibold">
            <span
              className={reviews.thisWeek > 0 ? "text-open-deep" : "text-pin"}
            >
              {reviews.thisWeek}
            </span>
            <span className="text-muted">/{reviews.target}</span>
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
          <div
            className={`h-full rounded-full transition-all ${
              reviews.thisWeek > 0 ? "bg-open" : "bg-pin/30"
            }`}
            style={{ width: `${Math.max(reviewPct, 3)}%` }}
          />
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
          {reviews.daysSinceLastReview === null
            ? "We haven't seen a review come in yet. Reviews are the strongest thing you can move for Google ranking."
            : `Your last review was ${reviews.daysSinceLastReview} days ago. Reviews are vital for good Google ranking.`}
        </p>

        <div className="mt-5 flex items-center justify-between gap-1 border-t border-rule-soft pt-4 text-center">
          {["More customers", "More reviews", "Better ranking"].map(
            (step, i) => (
              <div key={step} className="flex flex-1 items-center gap-1">
                <span className="flex-1 text-[10px] font-medium text-muted">
                  {step}
                </span>
                {i < 2 ? (
                  <span aria-hidden className="text-open-deep">
                    →
                  </span>
                ) : null}
              </div>
            ),
          )}
        </div>
      </section>

      {note ? (
        <p className="mt-5 rounded-[12px] bg-open-soft px-4 py-3 text-[13px] leading-snug">
          {note}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-[12px] bg-pin-soft px-4 py-3 text-[13px] leading-snug"
        >
          {error}
        </p>
      ) : null}

      {!business.reviewUri ? (
        <button
          type="button"
          onClick={() => void refreshListing()}
          disabled={busy}
          className="mt-5 text-[13px] font-medium text-pin hover:opacity-80"
        >
          refresh listing from google
        </button>
      ) : null}

      {/* --------------------------- agent state ------------------------- */}
      <section className="inset-group mt-8">
        <div className="hairline-b flex items-center justify-between gap-3 px-5 py-3.5">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <span aria-hidden className="text-pin">
              ✦
            </span>
            GBP AI agent
          </p>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              business.agentActive
                ? "bg-open-soft text-open-deep"
                : "bg-paper-3 text-ink-soft"
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

        <ul>
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
            href="/app/website"
            label={business.website ? "Your website" : "Free website"}
            detail={
              business.website
                ? "a page that matches your listing exactly"
                : "you don't have one — we can build it from your listing"
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
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink">
          Google Business Profile
        </h2>
        <ol className="mt-4 space-y-0">
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
                  className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                    step.done
                      ? "bg-open text-white"
                      : "bg-paper-3 text-transparent"
                  }`}
                >
                  ✓
                </span>
                {i < all.length - 1 ? (
                  <span aria-hidden className="w-px flex-1 bg-rule" />
                ) : null}
              </span>
              <span
                className={`pb-5 text-[14px] ${
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
      <section className="mt-4">
        <h2 className="text-[15px] font-semibold text-ink">
          What we&rsquo;ve done
        </h2>

        {actions.length === 0 ? (
          <p className="card mt-4 px-5 py-8 text-center text-[13px] leading-relaxed text-muted">
            Nothing yet. The first post goes out once setup is finished.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {actions.map((action) => (
              <li
                key={action._id}
                className="card p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-pin-soft px-2.5 py-0.5 text-[11px] font-medium text-pin">
                    {action.type.replace("_", " ")}
                  </span>
                  <span className="flex-none text-[12px] text-muted">
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
    <li className="inset-row">
      <Link href={href} className="flex items-center gap-3 px-5 py-4">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-tight">
            {label}
          </span>
          <span className="mt-0.5 block text-[12px] text-muted">{detail}</span>
        </span>
        <span aria-hidden className="flex-none text-muted">
          ›
        </span>
      </Link>
    </li>
  );
}
