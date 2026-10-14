# Metabase reporting

Metabase cannot query Convex directly. Footfall keeps Convex as the source of
truth and mirrors a small, privacy-safe reporting projection into Supabase
Postgres. Metabase connects to that Postgres database and owns the charts,
funnel and admin reporting UI.

The export includes:

- `metabase_analytics_events` — server-confirmed funnel and revenue events;
- `metabase_analytics_daily` — daily trend aggregates;
- `metabase_analytics_totals` — lifetime event aggregates; and
- `metabase_businesses` — the masked, read-only business/admin projection.

It does not export OAuth tokens, auth rows, payment provider ids, messages,
emails, review text or unmasked phone/email values.

## 1. Create the Supabase reporting tables

Run [`supabase/metabase.sql`](../supabase/metabase.sql) in the Supabase SQL
editor.

## 2. Automatic Convex sync (recommended)

`internal.metabaseSync.syncToSupabase` runs from Convex every two hours. It
reads the private reporting projection and upserts it directly to Supabase, so
it **does not use `METABASE_EXPORT_SECRET`**.

Set these two server-only variables in each Convex deployment that should sync:

```sh
npx convex env set --prod SUPABASE_URL "https://<project-ref>.supabase.co"
npx convex env set --prod SUPABASE_SERVICE_ROLE_KEY "<service-role-key>"
```

The service-role key is used only by the internal Convex action to upsert the
reporting tables. Never put either variable in `NEXT_PUBLIC_*` or a browser
bundle. A missing variable makes the cron log a skipped run rather than export
any data.

## 3. Manual sync (optional)

The local `scripts/sync-metabase.mjs` path is retained for a one-off/manual
mirror. Unlike the Convex cron, it runs outside Convex and calls protected HTTP
export endpoints, so it needs a separate `METABASE_EXPORT_SECRET` in both the
Convex deployment and the shell running the script:

```sh
npx convex env set METABASE_EXPORT_SECRET "$(openssl rand -hex 32)"
```

Never put this secret in a `NEXT_PUBLIC_*` variable.

The manual export routes are:

- `POST /metabase/export/analytics-events`
- `POST /metabase/export/analytics-daily`
- `POST /metabase/export/analytics-totals`
- `POST /metabase/export/businesses`

They return `404` unless the `x-metabase-export-secret` header matches the
Convex deployment secret.

### Run a manual sync

The sync script needs the Convex site URL, Supabase project URL, and a
Supabase service-role key. The service-role key is server-only and is never
used by the browser.

```sh
CONVEX_SITE_URL=https://<deployment>.convex.site \
METABASE_EXPORT_SECRET=<same-secret-as-convex> \
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/sync-metabase.mjs
```

For local development, Node 20+ can load a private env file:

```sh
node --env-file=.env.local scripts/sync-metabase.mjs
```

The manual sync is idempotent: Convex ids are upsert keys, and the aggregate
rows are updated in place. The Convex cron is the normal scheduled path.

## 4. Connect Metabase to Supabase

In Metabase, add a PostgreSQL database using the Supabase connection details.
Require SSL and use a read-only database credential for Metabase. Do not use
the Supabase service-role key as a database password.

Build the dashboard from the four `metabase_*` tables. The funnel order is:

1. `account_created`
2. `gbp_connect_started`
3. `business_connected`
4. `checkout_started`
5. `payment_succeeded`
6. `onboarding_completed`
7. `content_published`

Use `occurred_at` for time filters and `metadata` only for the allowlisted,
non-PII values documented in `docs/product-analytics.md`.

## 5. Add the Metabase link to Footfall

Set this build-time variable in the Next app:

```env
NEXT_PUBLIC_METABASE_URL=http://127.0.0.1:3001
```

The internal analytics page keeps its existing Convex view and shows an
**Open Metabase** link when this variable is present. In production, point it
to the HTTPS Metabase URL.

The app currently uses port `3000` locally. If Next is also running on port
`3000`, expose the Metabase container on another host port, for example:

```sh
docker stop metabase && docker rm metabase
docker volume create metabase-data
docker run -d -p 3001:3000 --name metabase \\
  -v metabase-data:/metabase.db \\
  metabase/metabase
```
