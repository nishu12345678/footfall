/**
 * Client-visible feature flags.
 *
 * NEXT_PUBLIC_* values are embedded into the browser bundle at build time.
 * They are presentation gates only; matching backend flags must enforce the
 * same restriction because a client flag can always be bypassed.
 */
export const TWILIO_UI_ENABLED =
  process.env.NEXT_PUBLIC_TWILIO_ENABLED === "1";
