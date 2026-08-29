import { convexAuth } from "@convex-dev/auth/server";
import { Phone } from "@convex-dev/auth/providers/Phone";

/**
 * Mobile-number sign-in.
 *
 * Convex Auth owns the session, the JWT and the users table. MSG91 only
 * delivers the code. There is no email and no password — a shop owner
 * signs in with the number they already give customers.
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

export const MSG91Phone = Phone({
  id: "msg91",
  // The code is valid for 5 minutes.
  maxAge: 60 * 5,

  normalizeIdentifier: (phone) => normalisePhone(phone),

  // A 4-digit code, matching the OTP length the MSG91 template is built for.
  // Convex Auth also requires the original phone number at verification time
  // for tokens this short, which it enforces for us.
  async generateVerificationToken() {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return String(1000 + (bytes[0] % 9000));
  },

  async sendVerificationRequest({ identifier: phone, token }) {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const senderId = process.env.MSG91_SENDER_ID;

    if (!authKey || !templateId) {
      // No MSG91 configured — log the code so the flow stays testable.
      console.log(`[otp] ${phone} -> ${token} (MSG91 not configured)`);
      return;
    }

    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.searchParams.set("template_id", templateId);
    url.searchParams.set("mobile", phone);
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

    // MSG91 answers 200 with {"type":"error"} for template problems, so the
    // body matters as much as the status code.
    if (!res.ok || payload.includes('"type":"error"')) {
      throw new Error(`MSG91 refused the request: ${payload}`);
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [MSG91Phone],
});
