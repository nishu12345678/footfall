"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { OnboardingTop, nextHref, saveLabel, useEditMode } from "@/components/onboarding-frame";

type Fields = {
  orgName: string;
  locationName: string;
  streetAddress: string;
  city: string;
  pinCode: string;
  phone: string;
  email: string;
  website: string;
};

const EMPTY: Fields = {
  orgName: "",
  locationName: "",
  streetAddress: "",
  city: "",
  pinCode: "",
  phone: "",
  email: "",
  website: "",
};

/**
 * Step 2 — Location Information.
 * Everything is pre-filled from the Google listing. The owner is confirming
 * what we already know, not filling in a form.
 */
export default function LocationPage() {
  const business = useQuery(api.businesses.mine);
  const save = useMutation(api.businesses.updateLocation);
  const edit = useEditMode();

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!business || loaded) return;
    setFields({
      orgName: business.orgName ?? "",
      locationName: business.locationName ?? "",
      streetAddress: business.streetAddress ?? "",
      city: business.city ?? "",
      pinCode: business.pinCode ?? "",
      phone: business.phone ?? "",
      email: business.email ?? "",
      website: business.website ?? "",
    });
    setLoaded(true);
  }, [business, loaded]);

  if (business === undefined) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-[13px] text-muted">loading…</p>
      </main>
    );
  }

  if (business === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6">
        <h1 className="text-[clamp(1.8rem,5vw,2.2rem)]">connect google first</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          We fill this step in from your Google listing, so it has to be
          connected before there&rsquo;s anything to confirm.
        </p>
        <a href="/app/connect" className="btn btn-primary mt-8 w-full">
          connect google
        </a>
      </main>
    );
  }

  const set = (key: keyof Fields) => (value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await save({
        orgName: fields.orgName.trim(),
        locationName: fields.locationName.trim() || undefined,
        streetAddress: fields.streetAddress.trim() || undefined,
        city: fields.city.trim() || undefined,
        pinCode: fields.pinCode.trim() || undefined,
        phone: fields.phone.trim() || undefined,
        email: fields.email.trim() || undefined,
        website: fields.website.trim() || undefined,
      });
      window.location.href = nextHref(2, edit);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-8 sm:py-12">
      <OnboardingTop step={2} edit={edit} />

      <form
        className="mt-10 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && fields.orgName.trim()) void submit();
        }}
      >
        <h1 className="text-[clamp(1.9rem,5vw,2.2rem)]">
          location information
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Straight from your Google listing. Fix anything that&rsquo;s wrong —
          what&rsquo;s here is what customers see.
        </p>

        <div className="mt-9 space-y-6">
          <Field
            label="organisation name"
            value={fields.orgName}
            onChange={set("orgName")}
            required
          />
          <Field
            label="location name"
            value={fields.locationName}
            onChange={set("locationName")}
            hint="how you tell your branches apart"
          />
          <Field
            label="street address"
            value={fields.streetAddress}
            onChange={set("streetAddress")}
            multiline
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="city" value={fields.city} onChange={set("city")} />
            <Field
              label="pin code"
              value={fields.pinCode}
              onChange={set("pinCode")}
              inputMode="numeric"
            />
          </div>
          <Field
            label="business phone"
            value={fields.phone}
            onChange={set("phone")}
            inputMode="tel"
            hint="the number customers call"
          />
          <Field
            label="email"
            value={fields.email}
            onChange={set("email")}
            inputMode="email"
          />
          <Field
            label="website"
            value={fields.website}
            onChange={set("website")}
            hint="leave blank if you don't have one"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-[12px] bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !fields.orgName.trim()}
          className="btn btn-primary mt-10 w-full disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveLabel(edit, busy)}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  required,
  multiline,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  required?: boolean;
  multiline?: boolean;
  inputMode?: "numeric" | "tel" | "email";
}) {
  const id = label.replace(/\s+/g, "-");
  const shared =
    "mt-2 w-full rounded-[12px] border border-rule bg-white px-4 py-3.5 text-[16px] leading-snug outline-none placeholder:text-muted/60 focus:border-pin";

  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {label}
        {required ? <span className="text-pin"> *</span> : null}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${shared} resize-none`}
        />
      ) : (
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={shared}
        />
      )}
      {hint ? (
        <p className="mt-1.5 text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
