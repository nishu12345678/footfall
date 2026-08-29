"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/content";

type Method = "phone" | "email";
type Step = "identify" | "code";

const CODE_LENGTH = { phone: 4, email: 6 } as const;

export default function LoginPage() {
  const { signIn } = useAuthActions();

  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<Step>("identify");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "send" | "verify" | "google">(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const digits = phone.replace(/\D/g, "");
  // One canonical identifier everywhere: country code + 10 digits.
  const e164 = `91${digits}`;
  const cleanEmail = email.trim().toLowerCase();

  const identifierReady =
    method === "phone" ? digits.length === 10 : /^\S+@\S+\.\S+$/.test(cleanEmail);
  const expectedLength = CODE_LENGTH[method];
  const codeReady = code.replace(/\D/g, "").length === expectedLength;
  const sentTo = method === "phone" ? `+91 ${digits}` : cleanEmail;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function reset(next: Method) {
    setMethod(next);
    setStep("identify");
    setCode("");
    setError(null);
    setDetail(null);
  }

  function report(e: unknown, fallback: string) {
    console.error("[signIn]", e);
    setError(fallback);
    setDetail(e instanceof Error ? e.message : String(e));
  }

  async function sendCode() {
    setBusy("send");
    setError(null);
    setDetail(null);
    try {
      if (method === "phone") {
        await signIn("msg91", { phone: e164 });
      } else {
        await signIn("email-otp", { email: cleanEmail });
      }
      setStep("code");
      setSecondsLeft(30);
    } catch (e) {
      report(
        e,
        method === "phone"
          ? "Couldn't send the SMS. Try email instead."
          : "Couldn't send the email. Check the address and try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode() {
    setBusy("verify");
    setError(null);
    setDetail(null);
    const value = code.replace(/\D/g, "");
    try {
      if (method === "phone") {
        await signIn("msg91", { phone: e164, code: value });
      } else {
        await signIn("email-otp", { email: cleanEmail, code: value });
      }
      window.location.href = "/app";
    } catch (e) {
      report(e, "That code isn't right. Check it, or ask for a new one.");
      setBusy(null);
    }
  }

  async function continueWithGoogle() {
    setBusy("google");
    setError(null);
    setDetail(null);
    try {
      await signIn("google");
    } catch (e) {
      report(e, "Google sign-in didn't work. Try your number or email.");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-12">
      <div className="flex flex-1 flex-col justify-center">
        <div className="text-center">
          <span
            aria-hidden
            className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] border border-ink bg-pin text-[20px] text-paper-2 shadow-[3px_3px_0_var(--color-ink)]"
          >
            ◎
          </span>
          <h1 className="mt-5 font-display text-[2.4rem] font-bold tracking-tight">
            {BRAND.name}
          </h1>
          <p className="mt-2 text-[15px] text-ink-soft">
            {step === "identify"
              ? "sign in to run your google listing"
              : `we sent a ${expectedLength}-digit code to ${sentTo}`}
          </p>
        </div>

        {step === "identify" ? (
          <div className="mt-9">
            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              disabled={busy !== null}
              className="btn btn-ghost w-full disabled:opacity-50"
            >
              <GoogleMark />
              {busy === "google" ? "opening google…" : "continue with google"}
            </button>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-rule" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                or
              </span>
              <span className="h-px flex-1 bg-rule" aria-hidden />
            </div>

            <div
              role="group"
              aria-label="sign-in method"
              className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-ink bg-paper p-1"
            >
              {(["phone", "email"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => reset(m)}
                  aria-pressed={method === m}
                  className={`rounded-full px-4 py-1.5 font-display text-[13px] font-semibold transition-colors ${
                    method === m
                      ? "bg-ink text-paper-2"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {m === "phone" ? "mobile number" : "email"}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (identifierReady && !busy) void sendCode();
              }}
            >
              {method === "phone" ? (
                <>
                  <label htmlFor="phone" className="eyebrow">
                    mobile number
                  </label>
                  <div className="mt-2 flex gap-2">
                    <span className="flex items-center gap-1.5 rounded-[12px] border border-ink bg-paper-2 px-3 font-mono text-[14px]">
                      <span aria-hidden>🇮🇳</span> +91
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      placeholder="93191 02143"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.slice(0, 12))}
                      className="min-w-0 flex-1 rounded-[12px] border border-ink bg-paper-2 px-4 py-3.5 font-mono text-[16px] tracking-wide outline-none placeholder:text-muted/60"
                    />
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="email" className="eyebrow">
                    email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@shopname.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-[12px] border border-ink bg-paper-2 px-4 py-3.5 text-[16px] outline-none placeholder:text-muted/60"
                  />
                </>
              )}

              <button
                type="submit"
                disabled={!identifierReady || busy !== null}
                className="btn btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "send" ? "sending…" : "send code"}
              </button>
            </form>
          </div>
        ) : (
          <form
            className="mt-9"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeReady && !busy) void verifyCode();
            }}
          >
            <label htmlFor="code" className="eyebrow">
              {expectedLength}-digit code
            </label>
            <input
              id="code"
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={expectedLength}
              placeholder={"0".repeat(expectedLength)}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, expectedLength))
              }
              className="mt-2 w-full rounded-[12px] border border-ink bg-paper-2 px-4 py-3.5 text-center font-mono text-[26px] tracking-[0.4em] outline-none placeholder:text-muted/40"
            />

            <button
              type="submit"
              disabled={!codeReady || busy !== null}
              className="btn btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === "verify" ? "checking…" : "verify"}
            </button>

            <div className="mt-4 flex items-center justify-between text-[13px]">
              <button
                type="button"
                onClick={() => reset(method)}
                className="text-ink-soft underline underline-offset-4 hover:text-pin"
              >
                {method === "phone" ? "change number" : "change email"}
              </button>
              <button
                type="button"
                disabled={secondsLeft > 0 || busy !== null}
                onClick={() => void sendCode()}
                className="text-ink-soft underline underline-offset-4 hover:text-pin disabled:no-underline disabled:opacity-50"
              >
                {secondsLeft > 0 ? `resend in ${secondsLeft}s` : "resend code"}
              </button>
            </div>
          </form>
        )}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-[12px] border border-pin bg-pin-soft px-4 py-3 text-[14px] leading-snug text-ink"
          >
            {error}
            {detail ? (
              <span className="mt-2 block max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-soft">
                {detail}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <p className="text-center font-mono text-[11px] leading-relaxed text-muted">
        no password. we only use this to sign you in.
      </p>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.6 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.9l7.3-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"
      />
    </svg>
  );
}
