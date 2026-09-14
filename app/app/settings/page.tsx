"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { friendlyError } from "@/lib/errors";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Account settings: who you are, how you sign in, what's connected, and
 * the things you can change or take back. Free of the paywall — a lapsed
 * owner must still be able to sign out and disconnect Google.
 */
export default function SettingsPage() {
  const me = useQuery(api.account.me);
  const businesses = useQuery(api.businesses.list);
  const switchTo = useMutation(api.businesses.switchTo);
  const { signOut } = useAuthActions();
  const disconnect = useAction(api.google.disconnect);
  const signOutEverywhere = useAction(api.account.signOutEverywhere);

  const [switching, setSwitching] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "signout" | "everywhere" | "disconnect">(null);
  const [confirming, setConfirming] = useState<null | "everywhere" | "disconnect">(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Session gone underneath us (signed out elsewhere): go to sign-in.
  useEffect(() => {
    if (me === null) window.location.replace("/app/login");
  }, [me]);

  if (me === undefined || me === null) return <Loading />;

  async function doSignOut() {
    setBusy("signout");
    setError(null);
    try {
      // Convex Auth deletes the session and its refresh tokens on the
      // server and clears the cookies; a hard navigation then drops every
      // bit of client state with it, so nothing signed-in survives.
      await signOut();
    } catch (e) {
      // Even if the server call fails, the cookies are cleared; the login
      // page is the right place to land either way.
      console.error("[signOut]", e);
    } finally {
      window.location.replace("/app/login");
    }
  }

  async function doSignOutEverywhere() {
    setBusy("everywhere");
    setError(null);
    try {
      await signOutEverywhere({});
      await signOut().catch(() => undefined);
      window.location.replace("/app/login");
    } catch (e) {
      setError(friendlyError(e));
      setBusy(null);
      setConfirming(null);
    }
  }

  async function doDisconnect() {
    setBusy("disconnect");
    setError(null);
    setNote(null);
    try {
      const r = await disconnect({});
      setNote(
        r.revoked
          ? "Google access revoked and the listing disconnected. The agent is paused until you reconnect."
          : "Listing disconnected and our copy of the tokens deleted. Google didn't confirm the revocation — you can also remove footfall under your Google account's third-party access.",
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  const b = me.business;
  const who = me.user.name ?? me.user.email ?? me.user.phone ?? "You";

  async function doSwitch(businessId: string) {
    setSwitching(businessId);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await switchTo({ businessId: businessId as any });
      setNote("Switched. Everything in the app now shows this business.");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSwitching(null);
    }
  }

  return (
    <AppScreen
      name={b?.orgName ?? "footfall"}
      location={b?.locationName ?? b?.city ?? undefined}
      logoUrl={b?.logoUrl ?? undefined}
    >
      <BackButton fallback="/app" className="-ml-2 mb-4" />
      <h1 className="text-[clamp(1.8rem,5vw,2.2rem)]">settings</h1>

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

      {/* ------------------------------ account ------------------------------ */}
      <section className="inset-group mt-8">
        <div className="hairline-b px-5 py-3.5">
          <p className="text-[15px] font-semibold">Account</p>
          <p className="mt-0.5 text-[12px] text-muted">{who}</p>
        </div>
        <ul>
          <Row label="Mobile number" value={me.user.phone ? `+${me.user.phone}` : "—"} />
          <Row label="Email" value={me.user.email ?? "—"} />
          <Row
            label="Sign-in methods"
            value={
              [
                me.signIn.phone && "mobile OTP",
                me.signIn.email && "email OTP",
                me.signIn.google && "Google",
              ]
                .filter(Boolean)
                .join(" · ") || "—"
            }
          />
          <Row
            label="Plan"
            value={me.paid ? "active" : "none"}
            href="/app/billing"
          />
        </ul>
      </section>

      {/* ---------------------------- businesses ----------------------------- */}
      {businesses && businesses.length > 0 ? (
        <section className="inset-group mt-6">
          <div className="hairline-b px-5 py-3.5">
            <p className="text-[15px] font-semibold">Your businesses</p>
            <p className="mt-0.5 text-[12px] text-muted">
              Each business has its own setup and its own plan. Everything in
              the app — and the agent&rsquo;s background work — runs on the
              selected one.
            </p>
          </div>
          <ul>
            {businesses.map((biz) => (
              <li key={biz._id} className="inset-row">
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      {biz.orgName}
                      {biz.selected ? (
                        <span className="ml-2 rounded-full bg-open-soft px-2 py-0.5 text-[11px] font-medium text-open-deep">
                          selected
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {[
                        biz.city,
                        biz.connected ? "connected" : "google disconnected",
                        biz.planActive
                          ? `plan until ${biz.planExpiresAt ? fmtDate(biz.planExpiresAt) : "—"}`
                          : "no plan",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {!biz.selected ? (
                    <button
                      type="button"
                      onClick={() => void doSwitch(biz._id)}
                      disabled={switching !== null}
                      className="btn btn-ghost btn-sm flex-none disabled:opacity-50"
                    >
                      {switching === biz._id ? "switching…" : "switch"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="hairline-t px-5 py-3.5">
            <Link
              href="/app/connect"
              className="text-[13px] font-medium text-pin hover:opacity-80"
            >
              + connect another business
            </Link>
          </div>
        </section>
      ) : null}

      {/* ---------------------------- google profile ------------------------- */}
      <section className="inset-group mt-6">
        <div className="hairline-b px-5 py-3.5">
          <p className="text-[15px] font-semibold">Google Business Profile</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {me.googleBusiness && b?.connected
              ? `Connected${me.googleBusiness.googleEmail ? ` as ${me.googleBusiness.googleEmail}` : ""} on ${fmtDate(me.googleBusiness.connectedAt)}`
              : "Not connected"}
          </p>
        </div>
        <div className="px-5 py-4">
          {me.googleBusiness && b?.connected ? (
            <>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Disconnecting revokes our access at Google, deletes the tokens
                we hold, and pauses the agent. Your posts, reviews and report
                stay. You can reconnect any time — with the same or a
                different Google account.
              </p>
              {confirming === "disconnect" ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    disabled={busy !== null}
                    className="btn btn-ghost btn-sm"
                  >
                    keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDisconnect()}
                    disabled={busy !== null}
                    className="btn btn-primary btn-sm disabled:opacity-50"
                  >
                    {busy === "disconnect" ? "disconnecting…" : "yes, disconnect"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming("disconnect")}
                  disabled={busy !== null}
                  className="btn btn-ghost btn-sm mt-4 w-full"
                >
                  disconnect google business profile
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Everything in the app comes from your Google listing.
              </p>
              <Link href="/app/connect" className="btn btn-primary btn-sm mt-4 w-full">
                connect google business profile
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ---------------------------- edit onboarding ------------------------ */}
      {b ? (
        <section className="inset-group mt-6">
          <div className="hairline-b px-5 py-3.5">
            <p className="text-[15px] font-semibold">Edit onboarding</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {b.onboardingComplete
                ? "Change anything you told us during setup."
                : `Setup is on step ${b.onboardingStep} of 6.`}
            </p>
          </div>
          <ul>
            {ONBOARDING_STEPS.filter((s) => s.step >= 2).map((s) => (
              <Row
                key={s.step}
                label={`${s.step}. ${s.label}`}
                value={
                  s.step < b.onboardingStep || b.onboardingComplete ? "edit" : "not done yet"
                }
                href={
                  s.step <= b.onboardingStep || b.onboardingComplete
                    ? `${s.href}?edit=1`
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------ sign out ----------------------------- */}
      <section className="mt-8 space-y-3">
        <button
          type="button"
          onClick={() => void doSignOut()}
          disabled={busy !== null}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {busy === "signout" ? "signing out…" : "sign out"}
        </button>

        {confirming === "everywhere" ? (
          <div className="card p-4">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              This signs out every device, including this one
              {me.activeSessions > 1 ? ` (${me.activeSessions} sessions)` : ""}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={busy !== null}
                className="btn btn-ghost btn-sm"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={() => void doSignOutEverywhere()}
                disabled={busy !== null}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                {busy === "everywhere" ? "signing out…" : "sign out everywhere"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming("everywhere")}
            disabled={busy !== null}
            className="btn btn-ghost w-full disabled:opacity-50"
          >
            sign out of all devices
          </button>
        )}
      </section>
    </AppScreen>
  );
}

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1 text-[14px] font-medium">{label}</span>
      <span className="truncate text-[13px] text-muted">{value}</span>
      {href ? (
        <span aria-hidden className="flex-none text-muted">
          ›
        </span>
      ) : null}
    </>
  );
  return (
    <li className="inset-row">
      {href ? (
        <Link href={href} className="flex items-center gap-3 px-5 py-3.5">
          {inner}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3.5">{inner}</div>
      )}
    </li>
  );
}
