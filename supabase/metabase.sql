-- Reporting projection for Metabase.
-- Apply this in the Supabase SQL editor. Convex remains the source of truth;
-- these tables are refreshed by scripts/sync-metabase.mjs.

create table if not exists public.metabase_analytics_events (
  convex_id text primary key,
  event text not null,
  occurred_at timestamptz not null,
  day date not null,
  source text not null,
  dedupe_key text not null unique,
  user_id text,
  business_id text,
  amount_paise bigint,
  currency text,
  metadata jsonb
);

create index if not exists metabase_analytics_events_event_occurred_at_idx
  on public.metabase_analytics_events (event, occurred_at);
create index if not exists metabase_analytics_events_business_occurred_at_idx
  on public.metabase_analytics_events (business_id, occurred_at);

create table if not exists public.metabase_analytics_daily (
  convex_id text primary key,
  day date not null,
  event text not null,
  count integer not null,
  amount_paise bigint not null
);

create unique index if not exists metabase_analytics_daily_day_event_idx
  on public.metabase_analytics_daily (day, event);

create table if not exists public.metabase_analytics_totals (
  convex_id text primary key,
  event text not null unique,
  count integer not null,
  amount_paise bigint not null,
  first_occurred_at timestamptz not null,
  last_occurred_at timestamptz not null
);

create table if not exists public.metabase_businesses (
  convex_id text primary key,
  created_at timestamptz not null,
  org_name text not null,
  city text,
  owner_email_masked text,
  owner_phone_masked text,
  email_verified boolean not null,
  connected boolean not null,
  onboarding_step integer not null,
  onboarding_complete boolean not null,
  agent_active boolean not null,
  agent_started_at timestamptz,
  plan text,
  plan_expires_at timestamptz,
  plan_active boolean not null,
  first_value_at timestamptz,
  last_activity_at timestamptz
);

create index if not exists metabase_businesses_plan_active_idx
  on public.metabase_businesses (plan_active);
create index if not exists metabase_businesses_created_at_idx
  on public.metabase_businesses (created_at);

-- These are reporting tables, not browser-facing application tables. Keep RLS
-- enabled and grant the sync job's service role access through Supabase's
-- service-role key. Connect Metabase with a read-only Postgres credential.
alter table public.metabase_analytics_events enable row level security;
alter table public.metabase_analytics_daily enable row level security;
alter table public.metabase_analytics_totals enable row level security;
alter table public.metabase_businesses enable row level security;
