"use client";

import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { PRICING } from "@/lib/content";

/* Razorpay Checkout attaches itself to window. */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
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

export default function BillingPage() {
  const router = useRouter();
  const status = useQuery(api.billing.status);
  const createOrder = useAction(api.billing.createOrder);
  const verifyPayment = useAction(api.billing.verifyPayment);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Load Checkout once. It is a script tag rather than a package because
  // Razorpay requires their hosted copy — a bundled one is not supported.
  useEffect(() => {
    if (window.Razorpay) {
      setReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_JS}"]`,
    );
    const el = existing ?? document.createElement("script");
    const onLoad = () => setReady(true);
    const onError = () =>
      setError("Could not reach Razorpay. Check your connection and reload.");
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

  const pay = useCallback(
    async (planId: string) => {
      setError(null);
      setBusy(planId);
      try {
        if (!window.Razorpay) throw new Error("Payment window is still loading.");

        const order = await createOrder({
          plan: planId as "monthly" | "yearly",
        });

        const checkout = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: order.currency,
          name: "footfall",
          description:
            planId === "yearly" ? "One year of footfall" : "One month of footfall",
          theme: { color: "#2f5bea" },
          // Razorpay calls this once the payment succeeds. The webhook
          // confirms the same payment independently, so closing the tab
          // here does not lose the purchase.
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await verifyPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              router.push("/app");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Payment went through but we could not confirm it. It will appear shortly.",
              );
            } finally {
              setBusy(null);
            }
          },
          modal: { ondismiss: () => setBusy(null) },
        } as unknown as Record<string, unknown>);

        checkout.on("payment.failed", () => {
          setError("That payment did not go through. Nothing has been charged.");
          setBusy(null);
        });

        checkout.open();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(null);
      }
    },
    [createOrder, verifyPayment, router],
  );

  if (status === undefined) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="text-[16px] text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      {status.active ? (
        <section className="card p-6">
          <p className="text-[14px] font-bold uppercase tracking-wider text-open">
            Active
          </p>
          <h1 className="mt-2 text-[1.7rem]">Your plan is running</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            You are on the <strong>{status.plan}</strong> plan. It runs until{" "}
            <strong>{status.expiresAt ? fmtDate(status.expiresAt) : "—"}</strong>
            .
          </p>
          <a href="/app" className="btn btn-primary mt-6 w-full">
            Go to my listing
          </a>
        </section>
      ) : (
        <>
          <h1 className="text-[1.9rem]">Choose your plan</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
            footfall starts running your Google listing the moment this is
            paid. Same product on both — the only difference is how often you
            pay.
          </p>
        </>
      )}

      {error ? (
        <p className="mt-5 rounded-xl border border-pin bg-pin-soft p-4 text-[16px] leading-relaxed text-ink">
          {error}
        </p>
      ) : null}

      {!status.active ? (
        <div className="mt-7 grid gap-4">
          {PRICING.plans.map((plan) => {
            const featured = Boolean(plan.badge);
            return (
              <section
                key={plan.id}
                className={`rounded-[16px] bg-white p-6 ${
                  featured
                    ? "border-2 border-pin shadow-lift"
                    : "border border-rule shadow-card"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[1.4rem]">{plan.name}</h2>
                  {plan.badge ? (
                    <span className="rounded-full bg-pin px-2.5 py-1 text-[12px] font-bold text-white">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[2.4rem] font-extrabold leading-none tracking-tight">
                    {inr(plan.price)}
                  </span>
                  <span className="text-[16px] text-muted">/ {plan.period}</span>
                  <span className="text-[16px] text-muted line-through">
                    {inr(plan.listPrice)}
                  </span>
                </p>

                {plan.period === "year" ? (
                  <p className="mt-2 text-[15px] text-ink-soft">
                    {inr(plan.perMonth)} a month, paid once.
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => pay(plan.id)}
                  disabled={busy !== null || !ready}
                  className="btn btn-primary mt-5 w-full disabled:opacity-60"
                >
                  {busy === plan.id
                    ? "Opening payment…"
                    : ready
                      ? plan.cta
                      : "Loading payment…"}
                </button>
              </section>
            );
          })}

          <p className="text-center text-[15px] leading-relaxed text-muted">
            Paid securely through Razorpay. UPI, card, netbanking or wallet.
            We never see your card details.
          </p>
        </div>
      ) : null}

      {status.receipts && status.receipts.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-[1.2rem]">Your payments</h2>
          <ul className="mt-4 divide-y divide-rule-soft border-y border-rule-soft">
            {status.receipts.map((r) => (
              <li
                key={`${r.paymentId}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span>
                  <span className="block text-[16px] font-semibold capitalize">
                    {r.plan}
                  </span>
                  <span className="block text-[14px] text-muted">
                    {r.paidAt ? fmtDate(r.paidAt) : "—"} · until{" "}
                    {r.expiresAt ? fmtDate(r.expiresAt) : "—"}
                  </span>
                </span>
                <span className="text-[16px] font-semibold">
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
