"use client";

import Link from "next/link";
import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PRICING } from "@/lib/content";
import { resumeHref } from "@/lib/onboarding";
import { BackButton } from "@/components/back-button";
import { describePaymentFailure } from "@/convex/paymentText";
import { friendlyError } from "@/lib/errors";

/* Razorpay Checkout attaches itself to window. */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      close?: () => void;
      on: (event: string, handler: (payload: unknown) => void) => void;
    };
  }
}

const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

type PlanId = "monthly" | "yearly";

/**
 * What the screen is doing, in order of how a payment goes:
 *
 *   idle        plan picker
 *   opening     asking the backend for an order
 *   checkout    Razorpay's window is up
 *   verifying   Checkout said "paid"; we're confirming with the server
 *   confirming  server says Razorpay hasn't captured yet (authorized /
 *               pending / webhook-only); the live `order` query flips us
 *               to done the moment it lands
 *   done        paid — the live `status` query shows the plan
 *
 * Anything that goes wrong lands in `error` with a next step, and the
 * plan picker comes back so they can try again.
 */
type Phase = "idle" | "opening" | "checkout" | "verifying" | "confirming";

type CheckoutFailure = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
};

export default function BillingPage() {
  const status = useQuery(api.billing.status);
  const createOrder = useAction(api.billing.createOrder);
  const verifyPayment = useAction(api.billing.verifyPayment);
  const checkOrder = useAction(api.billing.checkOrder);
  const noteDismissed = useMutation(api.billing.noteDismissed);
  const noteCheckoutFailure = useMutation(api.billing.noteCheckoutFailure);

  const [phase, setPhase] = useState<Phase>("idle");
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const [scriptState, setScriptState] = useState<"loading" | "ready" | "failed">(() =>
    typeof window !== "undefined" && window.Razorpay ? "ready" : "loading",
  );
  const [watchingLocal, setWatching] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [extendOk, setExtendOk] = useState(false);
  // Convex queries do not automatically rerun when only a deployment env var
  // changes. If createOrder sees a newer price, update the screen and require
  // a second click so the amount the owner accepts always matches Checkout.
  const [oneRupeeOverride, setOneRupeeOverride] = useState<boolean | null>(null);
  const oneRupeeTest = oneRupeeOverride ?? status?.oneRupeeTest ?? false;
  const inFlight = useRef(false);

  // A reopened or refreshed page: pick up the order that was in flight.
  const pendingAuthorized =
    status?.pending && status.pending.status === "authorized" ? status.pending.orderId : null;
  const watching = watchingLocal ?? pendingAuthorized;

  // The order we're watching, live. This is what makes the screen update
  // when the webhook lands after the browser gave up, and what makes a
  // refresh mid-payment show the right thing.
  const watched = useQuery(
    api.billing.order,
    watching ? { orderId: watching } : "skip",
  );

  // Everything below derives from the live order rather than being
  // written back into state, so a settled order can never leave the
  // screen stuck on a stale phase.
  const settled =
    watched !== undefined &&
    watched !== null &&
    ["paid", "partially_refunded", "expired", "refunded"].includes(watched.status);
  const mismatch = watched?.status === "mismatch";
  const livePhase: Phase = settled || mismatch ? "idle" : phase;
  const liveError =
    error ??
    (mismatch
      ? {
          title: "We need to look at this payment",
          body: `Razorpay confirmed a payment that doesn't match what we asked for. Nothing has been granted yet. Please contact support with order ${watched?.orderId}. If you were charged, it will be returned.`,
        }
      : null);

  // Load Checkout once. It is a script tag rather than a package because
  // Razorpay requires their hosted copy — a bundled one is not supported.
  useEffect(() => {
    if (window.Razorpay) return;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_JS}"]`,
    );
    const el = existing ?? document.createElement("script");
    const onLoad = () => setScriptState("ready");
    const onError = () => setScriptState("failed");
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    if (!existing) {
      el.src = CHECKOUT_JS;
      el.async = true;
      document.body.appendChild(el);
    }
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, []);

  // ondismiss fires for a successful close too; only treat it as a
  // cancel if we were still at the checkout stage.
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
    // A settled order releases the "one at a time" latch too.
    if (livePhase === "idle") inFlight.current = false;
  }, [phase, livePhase]);

  const fail = useCallback((title: string, body: string) => {
    setError({ title, body });
    setPhase("idle");
    inFlight.current = false;
  }, []);

  const pay = useCallback(
    async (planId: PlanId) => {
      // One payment at a time, whatever gets double-tapped.
      if (inFlight.current) return;
      inFlight.current = true;
      setError(null);
      setPlan(planId);
      // Stop watching the last order, or a paid one would keep forcing
      // the screen back to idle while this one opens.
      setWatching(null);
      setPhase("opening");

      let order: Awaited<ReturnType<typeof createOrder>>;
      try {
        if (!window.Razorpay) throw new Error("Payment window is still loading.");
        order = await createOrder({ plan: planId });
      } catch (e) {
        fail(
          "Couldn't start the payment",
          friendlyError(e, "Check your connection and try again."),
        );
        return;
      }

      // Eligibility can change after this page rendered. Never open a Checkout
      // whose authoritative server price differs from the price on the button
      // the owner just accepted. Update the UI, then require one fresh click.
      if (order.oneRupeeTest !== oneRupeeTest) {
        setOneRupeeOverride(order.oneRupeeTest);
        fail(
          "The payment price changed",
          order.oneRupeeTest
            ? "Your ₹1 production test price is now active. Review the updated price and tap Pay again."
            : "The ₹1 production test price is no longer active. Review the normal price before continuing.",
        );
        return;
      }

      const orderId = order.orderId;
      setWatching(orderId);

      let checkout: InstanceType<NonNullable<Window["Razorpay"]>>;
      try {
        checkout = new window.Razorpay!({
          key: order.keyId,
          order_id: orderId,
          amount: order.amountPaise,
          currency: order.currency,
          name: "footfall",
          description: order.oneRupeeTest
            ? `Production test · full ${planId} plan`
            : planId === "yearly"
              ? "One year of footfall"
              : "One month of footfall",
          theme: { color: "#2b4eff" },
          // Razorpay calls this once the payment succeeds. The webhook
          // confirms the same payment independently, so closing the tab
          // here does not lose the purchase.
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            setPhase("verifying");
            try {
              const result = await verifyPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              if (result.state === "paid") {
                // `status` and `order` are live; the screen flips itself.
                setPhase("idle");
                inFlight.current = false;
                return;
              }
              if (result.state === "mismatch") {
                fail(
                  "We need to look at this payment",
                  `Razorpay's record doesn't match what we asked for. Nothing has been granted yet. Please contact support with payment ${response.razorpay_payment_id}.`,
                );
                return;
              }
              if (result.state === "failed") {
                fail(
                  "That payment didn't go through",
                  `${describePaymentFailure(null, result.reason)} Nothing has been charged.`,
                );
                return;
              }
              // authorized / pending / deferred: Razorpay has it, we're
              // waiting for the capture or the webhook.
              setPhase("confirming");
            } catch (e) {
              // Signature or network failure after Checkout said "paid".
              // The money may well have moved; the webhook and the
              // reconcile cron will settle it. Say exactly that.
              setPhase("confirming");
              setError({
                title: "Payment made, confirmation pending",
                body:
                  (friendlyError(e)) +
                  " We'll keep checking with Razorpay and this page updates by itself. If money left your account it is either credited to your plan or returned.",
              });
            }
          },
          modal: {
            // They closed the window. Nothing charged; the order stays
            // open for half an hour if they change their mind.
            ondismiss: () => {
              setPhase((p) => (p === "checkout" ? "idle" : p));
              if (inFlight.current && phaseRef.current === "checkout") {
                inFlight.current = false;
                void noteDismissed({ orderId }).catch(() => undefined);
              }
            },
            escape: true,
            confirm_close: true,
          },
          retry: { enabled: true, max_count: 4 },
          timeout: 15 * 60, // seconds; Checkout closes itself after this
        } as unknown as Record<string, unknown>);
      } catch (e) {
        fail("Couldn't open Razorpay", friendlyError(e));
        return;
      }

      // A declined card, a failed UPI, a bank timeout. Checkout keeps its
      // own window open for a retry; we record the reason so the screen
      // and support can see it even if the webhook is slow.
      checkout.on("payment.failed", (payload: unknown) => {
        const f = (payload as CheckoutFailure).error;
        void noteCheckoutFailure({
          orderId,
          paymentId: f?.metadata?.payment_id,
          code: f?.code,
          reason: f?.description ?? f?.reason,
        }).catch(() => undefined);
        setError({
          title: "That attempt didn't go through",
          body: `${describePaymentFailure(f?.code, f?.description ?? f?.reason)} Nothing has been charged — you can try again in the same window.`,
        });
      });

      setPhase("checkout");
      checkout.open();
    },
    [
      createOrder,
      verifyPayment,
      noteDismissed,
      noteCheckoutFailure,
      fail,
      oneRupeeTest,
    ],
  );

  const check = useCallback(async () => {
    const id = watching ?? status?.pending?.orderId;
    if (!id) return;
    setChecking(true);
    try {
      const r = await checkOrder({ orderId: id });
      if (r.state === "paid") {
        setError(null);
        setPhase("idle");
      } else if (r.state === "failed") {
        setError({
          title: "That payment didn't go through",
          body: `${describePaymentFailure(null, r.reason)} Nothing has been charged.`,
        });
        setPhase("idle");
        setWatching(null);
      } else if (r.state === "authorized") {
        setError({
          title: "Still with the bank",
          body: "Razorpay has the payment but hasn't captured it yet. This usually settles within minutes; we check every 15 minutes and the page updates itself.",
        });
      } else {
        setError({
          title: "Not confirmed yet",
          body: "Razorpay hasn't confirmed a payment on this order. If you paid, it will land within a few minutes and this page will update. If you didn't, just try again.",
        });
      }
    } catch (e) {
      setError({
        title: "Couldn't check just now",
        body: friendlyError(e),
      });
    } finally {
      setChecking(false);
    }
  }, [watching, status, checkOrder]);

  if (status === undefined) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <p className="text-[16px] text-muted">Loading…</p>
      </main>
    );
  }

  const busy = livePhase !== "idle";
  const pending = status.pending;
  const confirming =
    livePhase === "confirming" || (pendingAuthorized !== null && !status.active);
  const lastFailure =
    !busy && !liveError && pending?.status === "attempted" && pending.failureReason
      ? pending
      : null;
  const showPicker = !confirming && (!status.active || extendOk);

  return (
    <main className="mx-auto max-w-xl px-6 py-8 sm:py-12">
      <BackButton fallback={status.active ? "/app" : "/app/report"} className="-ml-2 mb-4" />

      {status.active ? (
        <section className="card p-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.05em] text-open-deep">
            Active
          </p>
          <h1 className="mt-3 text-[clamp(1.7rem,5vw,2rem)]">
            Your plan is running
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            {status.business ? (
              <>
                <strong>{status.business.orgName}</strong> is on the{" "}
                <strong>{status.plan}</strong> plan.
              </>
            ) : (
              <>
                You are on the <strong>{status.plan}</strong> plan.
              </>
            )}{" "}
            It runs until{" "}
            <strong>{status.expiresAt ? fmtDate(status.expiresAt) : "—"}</strong>
            . There is no auto-debit; we&rsquo;ll email you a week before it
            ends.
          </p>
          {/* Paid but mid-setup: the next step matters more than a dashboard
              of empty numbers. */}
          {status.business && !status.business.onboardingComplete ? (
            <Link
              href={resumeHref({
                onboardingStep: status.business.onboardingStep,
                onboardingComplete: status.business.onboardingComplete,
                gbpLocationName: status.business.connected ? "connected" : undefined,
              })}
              className="btn btn-primary mt-8 w-full"
            >
              continue setup — step {status.business.onboardingStep} of 6
            </Link>
          ) : (
            <Link href="/app" className="btn btn-primary mt-8 w-full">
              Go to my listing
            </Link>
          )}
          {!extendOk ? (
            <button
              type="button"
              onClick={() => setExtendOk(true)}
              className="mt-4 w-full text-center text-[14px] font-medium text-pin hover:opacity-80"
            >
              Pay for another period now
            </button>
          ) : (
            <p className="mt-4 text-[14px] leading-relaxed text-muted">
              A new period starts when the current one ends, so you lose
              nothing by paying early.
            </p>
          )}
        </section>
      ) : (
        <>
          <h1 className="text-[clamp(1.9rem,5vw,2.2rem)]">Choose your plan</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            {status.business ? (
              <>
                This plan runs <strong>{status.business.orgName}</strong> —
                each business you connect has its own plan.{" "}
              </>
            ) : null}
            footfall starts running your Google listing the moment this is
            paid. Same product on both — the only difference is how often you
            pay.
          </p>
        </>
      )}

      {oneRupeeTest ? (
        <p className="mt-5 rounded-[14px] bg-paper-2 px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
          Production test account: either plan costs ₹1 and includes the full
          normal access period with no feature limits.
        </p>
      ) : null}

      {/* ------------------------------ states ----------------------------- */}

      {liveError ? (
        <div
          role="alert"
          className="mt-5 rounded-[14px] bg-pin-soft p-4 text-[15px] leading-relaxed text-ink"
        >
          <p className="font-semibold">{liveError.title}</p>
          <p className="mt-1">{liveError.body}</p>
        </div>
      ) : null}

      {lastFailure ? (
        <div className="mt-5 rounded-[14px] bg-pin-soft p-4 text-[15px] leading-relaxed text-ink">
          <p className="font-semibold">Your last attempt didn&rsquo;t go through</p>
          <p className="mt-1">
            {lastFailure.failureText ?? describePaymentFailure(lastFailure.failureCode, lastFailure.failureReason)}{" "}
            Nothing was charged. Pick a plan below to try again.
          </p>
        </div>
      ) : null}

      {livePhase === "verifying" ? (
        <p className="mt-5 rounded-[14px] bg-paper-2 p-4 text-[15px] leading-relaxed text-ink">
          Payment made. Confirming it with Razorpay&hellip;
        </p>
      ) : null}

      {confirming ? (
        <section className="card mt-5 p-5">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <span
              aria-hidden
              className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-rule border-t-pin"
            />
            Waiting for Razorpay to confirm
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Your payment is with Razorpay. This usually takes seconds, sometimes
            a few minutes for UPI and netbanking. This page updates on its own
            — you can close it and come back; your plan starts the moment it
            lands.
          </p>
          <p className="mt-3 font-mono text-[12px] text-muted">
            order {watching ?? pending?.orderId}
            {(watched ?? pending)?.paymentId ? ` · payment ${(watched ?? pending)?.paymentId}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void check()}
            disabled={checking}
            className="btn btn-ghost btn-sm mt-4 w-full disabled:opacity-60"
          >
            {checking ? "Checking…" : "Check payment status now"}
          </button>
        </section>
      ) : null}

      {/* ------------------------------ plans ------------------------------ */}

      {showPicker ? (
        <div className="mt-9 grid gap-5">
          {scriptState === "failed" ? (
            <p className="rounded-[14px] bg-pin-soft p-4 text-[15px] leading-relaxed">
              Couldn&rsquo;t load Razorpay&rsquo;s payment window. Check your
              connection (or an ad blocker) and{" "}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="font-semibold text-pin"
              >
                reload
              </button>
              .
            </p>
          ) : null}

          {PRICING.plans.map((p) => {
            const featured = Boolean(p.badge);
            const ready = scriptState === "ready";
            return (
              <section
                key={p.id}
                className={`rounded-[18px] bg-white p-6 ${
                  featured ? "shadow-lift" : "shadow-card"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[1.4rem]">{p.name}</h2>
                  {p.badge ? (
                    <span className="rounded-full bg-pin-soft px-2.5 py-1 text-[12px] font-semibold text-pin">
                      {p.badge}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[2.4rem] font-extrabold leading-none tracking-tight">
                    {inr(oneRupeeTest ? 1 : p.price)}
                  </span>
                  <span className="text-[16px] text-muted">/ {p.period}</span>
                  <span className="text-[16px] text-muted line-through">
                    {inr(oneRupeeTest ? p.price : p.listPrice)}
                  </span>
                </p>

                {p.period === "year" && !oneRupeeTest ? (
                  <p className="mt-2 text-[15px] text-ink-soft">
                    {inr(p.perMonth)} a month, paid once.
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => pay(p.id as PlanId)}
                  disabled={busy || !ready}
                  className="btn btn-primary mt-6 w-full disabled:opacity-60"
                >
                  {busy && plan === p.id
                    ? livePhase === "opening"
                      ? "Opening payment…"
                      : livePhase === "checkout"
                        ? "Payment window open…"
                        : "Confirming…"
                    : ready
                      ? oneRupeeTest
                        ? "Pay ₹1 — full access"
                        : p.cta
                      : scriptState === "failed"
                        ? "Payment unavailable"
                        : "Loading payment…"}
                </button>
              </section>
            );
          })}

          <p className="text-center text-[15px] leading-relaxed text-muted">
            Paid securely through Razorpay. UPI, card, netbanking or wallet.
            We never see your card details. No auto-debit, ever.
          </p>
        </div>
      ) : null}

      {/* ----------------------------- receipts ---------------------------- */}

      {status.receipts && status.receipts.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-[1.2rem]">Your payments</h2>
          <ul className="inset-group mt-5">
            {status.receipts.map((r) => (
              <li
                key={r.id}
                className="inset-row flex items-center justify-between gap-3 px-5 py-4"
              >
                <span className="min-w-0">
                  <span className="block text-[16px] font-semibold capitalize">
                    {r.plan}
                    {r.status === "refunded" ? (
                      <span className="ml-2 rounded-full bg-paper-3 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                        refunded
                      </span>
                    ) : r.status === "partially_refunded" ? (
                      <span className="ml-2 rounded-full bg-paper-3 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                        {inr(r.refundedPaise / 100)} refunded
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[14px] text-muted">
                    {r.paidAt ? fmtDate(r.paidAt) : "—"} · until{" "}
                    {r.expiresAt ? fmtDate(r.expiresAt) : "—"}
                  </span>
                  {r.paymentId ? (
                    <span className="block truncate font-mono text-[11px] text-muted">
                      {r.paymentId}
                    </span>
                  ) : null}
                </span>
                <span className="flex-none text-[16px] font-semibold">
                  {inr(r.amountPaise / 100)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
