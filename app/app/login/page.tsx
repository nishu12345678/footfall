"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/content";

type Step = "phone" | "code";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const digits = phone.replace(/\D/g, "");
  // One canonical identifier everywhere: country code + 10 digits. Sending a
  // bare 10-digit number here creates a second account for the same person.
  const e164 = `91${digits}`;
  const phoneReady = digits.length === 10;
  const codeReady = code.replace(/\D/g, "").length === 4;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await signIn("msg91", { phone: e164 });
      setStep("code");
      setSecondsLeft(30);
    } catch (e) {
      console.error("[signIn] send failed", e);
      setError("Couldn't send the code. Check the number and try again.");
      setDetail(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      await signIn("msg91", { phone: e164, code: code.replace(/\D/g, "") });
      // The middleware redirects to /app once the session cookie is set.
      window.location.href = "/app";
    } catch (e) {
      console.error("[signIn] verify failed", e);
      setError("That code isn't right. Check it, or ask for a new one.");
      setDetail(e instanceof Error ? e.message : String(e));
      setBusy(false);
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
            {step === "phone"
              ? "sign in with the number your customers call"
              : `we sent a 4-digit code to ${digits}`}
          </p>
        </div>

        <div className="mt-9">
          {step === "phone" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (phoneReady && !busy) void sendCode();
              }}
            >
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

              <button
                type="submit"
                disabled={!phoneReady || busy}
                className="btn btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "sending…" : "send code"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (codeReady && !busy) void verifyCode();
              }}
            >
              <label htmlFor="code" className="eyebrow">
                4-digit code
              </label>
              <input
                id="code"
                ref={codeRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                placeholder="0000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="mt-2 w-full rounded-[12px] border border-ink bg-paper-2 px-4 py-3.5 text-center font-mono text-[28px] tracking-[0.5em] outline-none placeholder:text-muted/40"
              />

              <button
                type="submit"
                disabled={!codeReady || busy}
                className="btn btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "checking…" : "verify"}
              </button>

              <div className="mt-4 flex items-center justify-between text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setCode("");
                    setError(null);
                  }}
                  className="text-ink-soft underline underline-offset-4 hover:text-pin"
                >
                  change number
                </button>
                <button
                  type="button"
                  disabled={secondsLeft > 0 || busy}
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
              className="mt-4 rounded-[12px] border border-pin bg-pin-soft px-4 py-3 text-[14px] leading-snug text-ink"
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
      </div>

      <p className="text-center font-mono text-[11px] leading-relaxed text-muted">
        no password. no email. we only use your number to sign you in.
      </p>
    </main>
  );
}
