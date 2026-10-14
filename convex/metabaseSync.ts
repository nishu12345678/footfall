import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/* ---------------------------------------------------------------------------
   Supabase reporting mirror.

   This is the scheduled path: it reads the private reporting projection from
   Convex and upserts it directly into Supabase every two hours. It does NOT
   call the public HTTP export endpoints and therefore does not need
   METABASE_EXPORT_SECRET. It needs only server-side Supabase credentials in
   the Convex deployment environment.

   The HTTP export endpoints and scripts/sync-metabase.mjs remain the separate
   manual path. They use METABASE_EXPORT_SECRET because they run outside
   Convex and must authenticate back into the deployment.
--------------------------------------------------------------------------- */

const PAGE_SIZE = 100;

type Page<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
};

type AnalyticsEventRow = {
  id: string;
  event: string;
  occurredAt: number;
  day: string;
  source: string;
  dedupeKey: string;
  userId: string | null;
  businessId: string | null;
  amountPaise: number | null;
  currency: string | null;
  metadata: Record<string, string | number | boolean> | null;
};

type AnalyticsDailyRow = {
  id: string;
  day: string;
  event: string;
  count: number;
  amountPaise: number;
};

type AnalyticsTotalsRow = {
  id: string;
  event: string;
  count: number;
  amountPaise: number;
  firstOccurredAt: number;
  lastOccurredAt: number;
};

type BusinessRow = {
  id: string;
  createdAt: number;
  orgName: string;
  city: string | null;
  ownerEmailMasked: string | null;
  ownerPhoneMasked: string | null;
  emailVerified: boolean;
  connected: boolean;
  onboardingStep: number;
  onboardingComplete: boolean;
  agentActive: boolean;
  agentStartedAt: number | null;
  plan: string | null;
  planExpiresAt: number | null;
  planActive: boolean;
  firstValueAt: number | null;
  lastActivityAt: number | null;
};

type SyncResult = {
  configured: boolean;
  analyticsEvents: number;
  analyticsDaily: number;
  analyticsTotals: number;
  businesses: number;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function config(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

async function upsert(
  config: SupabaseConfig,
  table: string,
  rows: unknown[],
): Promise<void> {
  if (rows.length === 0) return;

  const response = await fetch(
    `${config.url}/rest/v1/${table}?on_conflict=convex_id`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Supabase upsert ${table} failed (${response.status}): ${detail}`,
    );
  }
}

async function syncPages<T>(args: {
  config: SupabaseConfig;
  table: string;
  getPage: (cursor: string | null) => Promise<Page<T>>;
  map: (row: T) => unknown;
}): Promise<number> {
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const result = await args.getPage(cursor);
    const rows = result.page.map(args.map);
    await upsert(args.config, args.table, rows);
    total += rows.length;
    if (result.isDone) return total;
    cursor = result.continueCursor;
  }
}

const iso = (milliseconds: number | null) =>
  milliseconds === null ? null : new Date(milliseconds).toISOString();

export const syncToSupabase = internalAction({
  args: {},
  returns: v.object({
    configured: v.boolean(),
    analyticsEvents: v.number(),
    analyticsDaily: v.number(),
    analyticsTotals: v.number(),
    businesses: v.number(),
  }),
  handler: async (ctx): Promise<SyncResult> => {
    const supabase = config();
    if (!supabase) {
      console.warn(
        "[metabase] Supabase sync skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unset",
      );
      return {
        configured: false,
        analyticsEvents: 0,
        analyticsDaily: 0,
        analyticsTotals: 0,
        businesses: 0,
      };
    }

    const now = Date.now();
    const analyticsEvents = await syncPages({
      config: supabase,
      table: "metabase_analytics_events",
      getPage: (cursor): Promise<Page<AnalyticsEventRow>> =>
        ctx.runQuery(internal.metabase.analyticsEvents, {
          paginationOpts: { cursor, numItems: PAGE_SIZE },
        }),
      map: (row) => ({
        convex_id: row.id,
        event: row.event,
        occurred_at: new Date(row.occurredAt).toISOString(),
        day: row.day,
        source: row.source,
        dedupe_key: row.dedupeKey,
        user_id: row.userId,
        business_id: row.businessId,
        amount_paise: row.amountPaise,
        currency: row.currency,
        metadata: row.metadata,
      }),
    });

    const analyticsDaily = await syncPages({
      config: supabase,
      table: "metabase_analytics_daily",
      getPage: (cursor): Promise<Page<AnalyticsDailyRow>> =>
        ctx.runQuery(internal.metabase.analyticsDaily, {
          paginationOpts: { cursor, numItems: PAGE_SIZE },
        }),
      map: (row) => ({
        convex_id: row.id,
        day: row.day,
        event: row.event,
        count: row.count,
        amount_paise: row.amountPaise,
      }),
    });

    const analyticsTotals = await syncPages({
      config: supabase,
      table: "metabase_analytics_totals",
      getPage: (cursor): Promise<Page<AnalyticsTotalsRow>> =>
        ctx.runQuery(internal.metabase.analyticsTotals, {
          paginationOpts: { cursor, numItems: PAGE_SIZE },
        }),
      map: (row) => ({
        convex_id: row.id,
        event: row.event,
        count: row.count,
        amount_paise: row.amountPaise,
        first_occurred_at: new Date(row.firstOccurredAt).toISOString(),
        last_occurred_at: new Date(row.lastOccurredAt).toISOString(),
      }),
    });

    const businesses = await syncPages({
      config: supabase,
      table: "metabase_businesses",
      getPage: (cursor): Promise<Page<BusinessRow>> =>
        ctx.runQuery(internal.metabase.businesses, {
          paginationOpts: { cursor, numItems: PAGE_SIZE },
          now,
        }),
      map: (row) => ({
        convex_id: row.id,
        created_at: new Date(row.createdAt).toISOString(),
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
    });

    console.log(
      `[metabase] synced Supabase: events=${analyticsEvents}, daily=${analyticsDaily}, totals=${analyticsTotals}, businesses=${businesses}`,
    );
    return {
      configured: true,
      analyticsEvents,
      analyticsDaily,
      analyticsTotals,
      businesses,
    };
  },
});
