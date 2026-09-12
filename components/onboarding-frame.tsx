"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@/convex/_generated/api";
import { BackButton } from "./back-button";
import { Steps } from "./steps";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

/**
 * Every setup screen serves twice: once during onboarding, and again from
 * Settings → Edit onboarding, when the owner comes back to change what
 * they told us. Same form, same validation, same mutation; only the frame
 * and the "where next" differ.
 *
 * Edit mode is `?edit=1` on the URL. It is read from `window.location`
 * rather than `useSearchParams` so the pages stay simple client
 * components without a Suspense boundary.
 */
const noop = () => () => {};
const readEdit = () =>
  new URLSearchParams(window.location.search).get("edit") === "1";

export function useEditMode(): boolean {
  // Server renders "not editing"; the client corrects it on hydration.
  return useSyncExternalStore(noop, readEdit, () => false);
}

/** Where a step's "save & next" goes: the next step, or back to Settings. */
export function nextHref(step: number, edit: boolean): string {
  if (edit) return "/app/settings";
  const next = ONBOARDING_STEPS.find((s) => s.step === step + 1);
  return next?.href ?? "/app";
}

/** Where "back" goes: the previous step, or Settings when editing. */
function backHref(step: number, edit: boolean): string {
  if (edit) return "/app/settings";
  const prev = ONBOARDING_STEPS.find((s) => s.step === step - 1);
  return prev?.href ?? "/app";
}

/** The label a "save" button should carry in each mode. */
export function saveLabel(edit: boolean, busy: boolean, normal = "save & next") {
  if (busy) return "saving…";
  return edit ? "save changes" : normal;
}

/**
 * The top of a setup screen: the progress bar during onboarding, or an
 * "editing" header when the owner came from Settings. Both carry a way
 * back.
 *
 * The Back button walks browser history when the owner navigated here from
 * inside the app (the dashboard's "setup isn't finished" card, Settings, a
 * step badge), and only falls back to the previous step on a fresh load.
 * Steps already unlocked are links, so any passed step can be reopened and
 * saved directly.
 */
export function OnboardingTop({ step, edit }: { step: number; edit: boolean }) {
  const business = useQuery(api.businesses.mine);
  const label = ONBOARDING_STEPS.find((s) => s.step === step)?.label ?? "";
  const reached = business
    ? business.onboardingComplete
      ? ONBOARDING_STEPS.length
      : business.onboardingStep
    : step;
  return (
    <div>
      <BackButton
        fallback={backHref(step, edit)}
        label={edit ? "Settings" : "Back"}
        className="-ml-2 mb-4"
      />
      {edit ? (
        <p className="eyebrow">editing · {label.toLowerCase()}</p>
      ) : (
        <Steps current={step} reached={reached} />
      )}
    </div>
  );
}
