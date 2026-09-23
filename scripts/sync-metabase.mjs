#!/usr/bin/env node

/*
 * Mirror the privacy-safe Convex reporting projection into Supabase Postgres.
 *
 * The script intentionally uses Supabase's REST endpoint instead of putting a
 * Postgres client or database credentials in the browser bundle. Run it from a
 * trusted cron/worker with the variables documented in docs/metabase.md.
 */

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const requiredAny = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
};

const convexSiteUrl = requiredAny(
  "CONVEX_SITE_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
).replace(/\/+$/, "");
const exportSecret = required("METABASE_EXPORT_SECRET");
const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const pageSize = 100;
const now = Date.now();

const iso = (milliseconds) =>
  milliseconds === null || milliseconds === undefined
    ? null
    : new Date(milliseconds).toISOString();

async function convexPage(path, cursor, includeNow) {
  const response = await fetch(`${convexSiteUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-metabase-export-secret": exportSecret,
    },
    body: JSON.stringify({
      cursor,
      numItems: pageSize,
      ...(includeNow ? { now } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Convex export ${path} failed (${response.status}): ${detail}`);
  }

  const payload = await response.json();
  if (
    !payload ||
    !Array.isArray(payload.page) ||
    typeof payload.isDone !== "boolean"
  ) {
    throw new Error(`Convex export ${path} returned an invalid page`);
  }
  if (!payload.isDone && typeof payload.continueCursor !== "string") {
    throw new Error(`Convex export ${path} did not return a cursor`);
  }
  return payload;
}

async function upsert(table, rows) {
  if (rows.length === 0) return;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?on_conflict=convex_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase upsert ${table} failed (${response.status}): ${detail}`);
  }
}

const resources = [
  {
    path: "/metabase/export/analytics-events",
    table: "metabase_analytics_events",
    includeNow: false,
    map: (row) => ({
      convex_id: row.id,
      event: row.event,
      occurred_at: iso(row.occurredAt),
      day: row.day,
      source: row.source,
      dedupe_key: row.dedupeKey,
      user_id: row.userId,
      business_id: row.businessId,
      amount_paise: row.amountPaise,
      currency: row.currency,
      metadata: row.metadata,
    }),
  },
  {
    path: "/metabase/export/analytics-daily",
    table: "metabase_analytics_daily",
    includeNow: false,
    map: (row) => ({
      convex_id: row.id,
      day: row.day,
      event: row.event,
      count: row.count,
      amount_paise: row.amountPaise,
    }),
  },
  {
    path: "/metabase/export/analytics-totals",
    table: "metabase_analytics_totals",
    includeNow: false,
    map: (row) => ({
      convex_id: row.id,
      event: row.event,
      count: row.count,
      amount_paise: row.amountPaise,
      first_occurred_at: iso(row.firstOccurredAt),
      last_occurred_at: iso(row.lastOccurredAt),
    }),
  },
  {
    path: "/metabase/export/businesses",
    table: "metabase_businesses",
    includeNow: true,
    map: (row) => ({
      convex_id: row.id,
      created_at: iso(row.createdAt),
      org_name: row.orgName,
      city: row.city,
      owner_email_masked: row.ownerEmailMasked,
      owner_phone_masked: row.ownerPhoneMasked,
      email_verified: row.emailVerified,
      connected: row.connected,
      onboarding_step: row.onboardingStep,
      onboarding_complete: row.onboardingComplete,
      agent_active: row.agentActive,
      agent_started_at: iso(row.agentStartedAt),
      plan: row.plan,
      plan_expires_at: iso(row.planExpiresAt),
      plan_active: row.planActive,
      first_value_at: iso(row.firstValueAt),
      last_activity_at: iso(row.lastActivityAt),
    }),
  },
];

async function syncResource(resource) {
  let cursor = null;
  let pages = 0;
  let rows = 0;

  while (true) {
    const payload = await convexPage(resource.path, cursor, resource.includeNow);
    const mapped = payload.page.map(resource.map);
    await upsert(resource.table, mapped);
    pages += 1;
    rows += mapped.length;

    if (payload.isDone) break;
    cursor = payload.continueCursor;
  }

  console.log(`synced ${resource.table}: ${rows} rows across ${pages} page(s)`);
}

try {
  for (const resource of resources) await syncResource(resource);
  console.log("Metabase reporting sync complete");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
