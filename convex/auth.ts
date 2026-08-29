import { convexAuth } from "@convex-dev/auth/server";
import { Phone } from "@convex-dev/auth/providers/Phone";
import { Email } from "@convex-dev/auth/providers/Email";
import Google from "@auth/core/providers/google";

/**
 * Three ways in, because shop owners don't all have the same habits:
 *
 *   msg91      mobile number + OTP   (the default — it's the number they
 *                                     already give customers)
 *   email-otp  email + 6-digit code  (fallback when SMS won't deliver)
 *   google     one tap               (fastest if they live in Gmail)
 *
 * Convex Auth owns the session, the JWT and the users table in all three
 * cases. Signing in with Google here is *identity only* — it is a separate
 * thing from connecting a Google Business Profile, which asks for the
 * business.manage scope in convex/google.ts.
 */

/** Digits only, with country code. "93191 02143" -> "919319102143" */
function normalisePhone(raw: string, countryCode = "91"): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return countryCode + digits;
  if (digits.length === 12 && digits.startsWith(countryCode)) return digits;
  if (digits.length === 13 && digits.startsWith("0" + countryCode)) {
    return digits.slice(1);
  }
  return digits;
}

function numericCode(length: number): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

/* ------------------------------ phone OTP ------------------------------- */

export const MSG91Phone = Phone({
  id: "msg91",
  maxAge: 60 * 5,
  normalizeIdentifier: (phone) => normalisePhone(phone),

  async generateVerificationToken() {
    return numericCode(4);
  },

  async sendVerificationRequest({ identifier: phone, token }) {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const senderId = process.env.MSG91_SENDER_ID;
    const mobile = normalisePhone(phone);

    // DEV ONLY. Prints the code into the Convex logs so sign-in is testable
    // without SMS credits. Never set OTP_DEV_ECHO on production.
    if (process.env.OTP_DEV_ECHO === "1") {
      console.log(`[otp-dev-echo] ${mobile} -> ${token}`);
    }

    if (!authKey || !templateId) {
      console.log(`[otp] ${mobile} -> ${token} (MSG91 not configured)`);
      return;
    }

    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.searchParams.set("template_id", templateId);
    url.searchParams.set("mobile", mobile);
    url.searchParams.set("otp", token);
    url.searchParams.set("otp_length", "4");
    url.searchParams.set("otp_expiry", "5");
    if (senderId) url.searchParams.set("sender", senderId);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: authKey },
      body: JSON.stringify({}),
    });

    const payload = await res.text();
    console.log(`[msg91] ${res.status} ${payload}`);

    if (!res.ok || payload.includes('"type":"error"')) {
      throw new Error(`MSG91 refused the request: ${payload}`);
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

  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.AUTH_RESEND_KEY;

    if (process.env.OTP_DEV_ECHO === "1") {
      console.log(`[otp-dev-echo] ${email} -> ${token}`);
    }

    if (!apiKey) {
      console.log(`[email-otp] ${email} -> ${token} (Resend not configured)`);
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "footfall <onboarding@resend.dev>",
        to: [email],
        subject: `${token} is your footfall code`,
        text: `Your footfall sign-in code is ${token}. It expires in 15 minutes.\n\nIf you didn't ask for this, ignore this email.`,
      }),
    });

    const payload = await res.text();
    if (!res.ok) {
      console.error(`[resend] ${res.status} ${payload}`);
      throw new Error(`Could not send the email: ${payload.slice(0, 200)}`);
    }
  },
});

/* -------------------------------- google -------------------------------- */

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [MSG91Phone, EmailOTP, Google],
});
