"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";

export default function ReviewsPage() {
  const data = useQuery(api.lists.reviews);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, rows } = data;

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      <h1 className="text-[1.6rem]">reviews</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Every review on your listing, and what we replied.</p>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-[14px] border border-dashed border-rule px-4 py-10 text-center text-[13px] leading-relaxed text-muted">
          No reviews pulled from Google yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li
              key={row._id}
              className="rounded-[14px] border border-rule bg-paper-2 p-4"
            >
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-ink-soft">
                {JSON.stringify(row, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </AppScreen>
  );
}
