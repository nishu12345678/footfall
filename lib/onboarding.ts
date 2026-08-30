/**
 * Where a half-finished setup should resume.
 *
 * An owner who closes the app mid-setup — which they will, because they're
 * working — must land back where they stopped, not at step one.
 */
export const ONBOARDING_STEPS = [
  { step: 1, href: "/app/connect", label: "Connect" },
  { step: 2, href: "/app/onboarding/location", label: "Location" },
  { step: 3, href: "/app/onboarding/about", label: "About" },
  { step: 4, href: "/app/onboarding/gbp", label: "GBP Info" },
  { step: 5, href: "/app/onboarding/website", label: "Website" },
  { step: 6, href: "/app/onboarding/others", label: "Finish" },
] as const;

export function resumeHref(business: {
  onboardingStep: number;
  onboardingComplete: boolean;
  gbpLocationName?: string;
}): string {
  if (!business.gbpLocationName) return "/app/connect";
  if (business.onboardingComplete) return "/app";

  const next = ONBOARDING_STEPS.find((s) => s.step === business.onboardingStep);
  return next?.href ?? "/app/onboarding/location";
}

export function resumeLabel(business: {
  onboardingStep: number;
  onboardingComplete: boolean;
}): string {
  const next = ONBOARDING_STEPS.find((s) => s.step === business.onboardingStep);
  return next ? `continue setup — ${next.label.toLowerCase()}` : "continue setup";
}
