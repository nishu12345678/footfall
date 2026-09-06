"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { shopUrl } from "@/lib/site-host";

export default function WebsitePage() {
  const data = useQuery(api.site.mine);
  const generate = useAction(api.site.generateSite);
  const setPublished = useMutation(api.site.setPublished);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, site } = data;
  const url = site ? shopUrl(site.slug) : null;

  async function build() {
    setBusy(true);
    setError(null);
    try {
      await generate({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      <h1 className="text-[1.6rem]">your website</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        A page built from your Google listing, so your name, address, phone and
        hours match Google exactly. That consistency is one of the few local SEO
        levers you fully control.
      </p>

      {site ? (
        <>
          <div className="card mt-6 p-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  site.published
                    ? "bg-open-soft text-open-deep"
                    : "bg-paper-3 text-ink-soft"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    site.published ? "bg-open" : "bg-muted"
                  }`}
                />
                {site.published ? "Live" : "Hidden"}
              </span>
              <span className="text-[12px] text-muted">
                updated{" "}
                {new Date(site.updatedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>

            <p className="mt-3 break-all font-mono text-[12px] text-ink-soft">
              /s/{site.slug}
            </p>
            <p className="mt-2 text-[15px] font-semibold leading-snug">
              {site.headline}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {site.metaDescription}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={shopUrl(site.slug)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
              >
                open my website
              </a>
              <button
                type="button"
                onClick={() => {
                  if (url) void navigator.clipboard?.writeText(url);
                }}
                className="btn btn-ghost btn-sm"
              >
                copy link
              </button>
              <button
                type="button"
                onClick={() =>
                  void setPublished({ published: !site.published })
                }
                className="ml-auto text-[13px] font-medium text-pin hover:opacity-80"
              >
                {site.published ? "hide it" : "make it live"}
              </button>
            </div>
          </div>

          <div className="card mt-4 p-4">
            <p className="text-[15px] font-semibold text-ink">
              What&rsquo;s on it
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-ink-soft">
              <li>· {site.services.length} services, written for local search</li>
              <li>· {site.faqs.length} questions customers actually ask</li>
              <li>· your opening hours, straight from Google</li>
              <li>· a tap-to-call button and directions link</li>
              <li>
                · LocalBusiness structured data, so Google can read the page
                properly
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => void build()}
            disabled={busy}
            className="btn btn-ghost mt-4 w-full disabled:opacity-40"
          >
            {busy ? "rewriting…" : "rewrite the copy"}
          </button>
        </>
      ) : (
        <div className="card mt-6 p-5">
          {business.website ? (
            <p className="text-[14px] leading-relaxed text-ink-soft">
              You already have a website at{" "}
              <span className="break-all font-mono text-[12px]">
                {business.website}
              </span>
              . You can still make one of these — some owners use it as a
              simpler page to send customers to.
            </p>
          ) : (
            <p className="text-[14px] leading-relaxed text-ink-soft">
              You don&rsquo;t have a website yet. We can make you one in about
              thirty seconds, using what&rsquo;s already on your Google listing.
              Nothing to write, nothing to host, no yearly fee.
            </p>
          )}

          <button
            type="button"
            onClick={() => void build()}
            disabled={busy}
            className="btn btn-primary mt-5 w-full disabled:opacity-40"
          >
            <span aria-hidden>✦</span>
            {busy ? "building…" : "create my website"}
          </button>
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-4 break-words rounded-[12px] bg-pin-soft px-3.5 py-2.5 text-[13px] leading-snug"
        >
          {error}
        </p>
      ) : null}
    </AppScreen>
  );
}
