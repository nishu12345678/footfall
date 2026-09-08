import { ConvexError } from "convex/values";
import { convexAuth } from "@convex-dev/auth/server";
import { Phone } from "@convex-dev/auth/providers/Phone";
import { Email } from "@convex-dev/auth/providers/Email";
import Google from "@auth/core/providers/google";
import type { EmailConfig } from "@auth/core/providers/email";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { sendNow as sendMessage, toE164 } from "./messaging";
import { sendNow as sendEmail } from "./email";

/**
 * Three ways in, because shop owners don't all have the same habits:
 *
 *   twilio     mobile number + OTP   (the default — it's the number they
 *                                     already give customers)
 *   email-otp  email + 6-digit code  (fallback when SMS won't deliver)
 *   google     one tap               (fastest if they live in Gmail)
 *
 * Convex Auth owns the session, the JWT and the users table in all three
 * cases. Signing in with Google here is *identity only* — it is a separate
 * thing from connecting a Google Business Profile, which asks for the
 * business.manage scope in convex/google.ts.
 *
 * SMS goes through Twilio (convex/messaging.ts) and email through Resend
 * (convex/email.ts). Both log every send; neither claims delivery it
 * can't see.
 */

function numericCode(length: number): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

/* ------------------------------ phone OTP ------------------------------- */

export const TwilioPhone = Phone({
  id: "twilio",
  maxAge: 60 * 5,
  // Digits only with the country code, "919319102143" — the identifier
  // is what the account is keyed on, so it must be canonical.
  normalizeIdentifier: (phone) => (toE164(phone) ?? String(phone)).replace(/\D/g, ""),

  async generateVerificationToken() {
    return numericCode(4);
  },

  async sendVerificationRequest({ identifier: phone, token }, ctx) {
    const to = toE164(phone);
    if (!to) throw new ConvexError("That mobile number isn't valid.");

    // DEV ONLY. Prints the code into the Convex logs so sign-in is testable
    // without SMS credits. Never set OTP_DEV_ECHO on production.
    if (process.env.OTP_DEV_ECHO === "1") {
      console.log(`[otp-dev-echo] ${to} -> ${token}`);
    }

    const result = await sendMessage(ctx, {
      to,
      channel: "sms",
      purpose: "otp",
      body: `${token} is your footfall sign-in code. It expires in 5 minutes. Don't share it with anyone.`,
      // One SMS per code. Convex Auth mints a new token on every "resend",
      // so a genuine resend still goes.
      dedupeKey: `otp:${to}:${token}`,
    });

    // A queued retry is not good enough for a sign-in code — the owner is
    // sitting there waiting. Tell them so they can use email instead.
    if (!result.ok || result.status === "queued") {
      throw new ConvexError(result.error ?? "Couldn't send the SMS just now.");
    }
  },
});

/* ------------------------------ email OTP ------------------------------- */

export const EmailOTP = Email({
  id: "email-otp",
  maxAge: 60 * 15,

  normalizeIdentifier: (email) => email.trim().toLowerCase(),

  async generateVerificationToken() {
    return numericCode(6);
  },

  // Convex Auth hands email providers the action ctx as a second argument
  // (see its signIn.ts); only the Auth.js type leaves it out.
  sendVerificationRequest: (async (
    { identifier: email, token }: { identifier: string; token: string },
    ctx: ActionCtx,
  ) => {
    if (process.env.OTP_DEV_ECHO === "1") {
      console.log(`[otp-dev-echo] ${email} -> ${token}`);
    }

    const result = await sendEmail(ctx, {
      to: email,
      subject: `${token} is your footfall code`,
      text: `Your footfall sign-in code is ${token}. It expires in 15 minutes.\n\nIf you didn't ask for this, ignore this email.`,
      purpose: "otp",
      dedupeKey: `otp:${email}:${token}`,
    });

    if (!result.ok || result.status === "queued") {
      throw new ConvexError(result.error ?? "Couldn't send the email just now.");
    }
  }) as unknown as EmailConfig["sendVerificationRequest"],
});

/* -------------------------------- google -------------------------------- */

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    TwilioPhone,
    EmailOTP,
    Google({
      authorization: {
        params: {
          // Always show Google's account chooser. Without this, Google
          // silently reuses whichever account the browser last used, and
          // an owner with a personal and a shop Gmail can't pick.
          prompt: "select_account",
          scope: "openid email profile",
        },
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // First sign-in ever: say hello, once. The email module dedupes on
      // the key, so a second account link on the same user can't repeat it.
      if (existingUserId === null) {
        await ctx.scheduler.runAfter(0, internal.email.sendToUser, {
          userId,
          template: "welcome",
          dedupeKey: `welcome:${userId}`,
        });
      }
    },
  },
});
