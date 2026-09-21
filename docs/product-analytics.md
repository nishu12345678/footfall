# Product analytics

This is the measurement contract for footfall. It separates three questions
that should never be answered from the same unreliable source.

1. **Acquisition (GA4):** how did an anonymous visitor reach us, which page did
   they read, and which call-to-action did they press?
2. **Activation and product use (Convex):** did the signed-in owner connect a
   listing, pay, finish setup and receive value? These are server-confirmed
   facts, not browser claims.
3. **Revenue (Razorpay + Convex):** was money captured, refunded or renewed?
   Convex's subscription ledger is accounting truth. GA revenue is only a
   marketing-attribution copy and may be blocked by the browser.

The internal dashboard reads Convex. GA must never be used as the customer
list, subscription ledger or support console.

## North-star and weekly scorecard

The closest early-stage north-star is **active businesses receiving value**:
a business with an active plan and at least one successful post, photo or
review-reply publish in the last 30 days. It cannot be inflated by page
refreshes and it corresponds to the work the customer bought.

Review these weekly:

| Stage | Metric | Source |
|---|---|---|
| Reach | users, sessions, source/medium, landing pages | GA4 |
| Intent | primary CTA clicks / landing-page users | GA4 |
| Signup | new accounts | Convex `account_created` |
| Connect | new businesses connected / new accounts | Convex |
| Monetise | checkout started, purchase, signup-to-paid conversion | Convex |
| Activate | onboarding completed / paid businesses | Convex |
| First value | first successful publish / activated businesses | Convex |
| Retain | active businesses receiving value in 30 days | Convex canonical rows |
| Revenue | captured revenue, refunds, active plans, MRR-like run rate | Convex subscriptions/refunds |

This product charges for a fixed period without auto-debit. `MRR` is therefore
shown as a **monthly run rate**, not GAAP recurring revenue: monthly plan amount
plus yearly plan amount divided by 12 for currently active plans.

## Funnel order

The actual product order is important: paid mutations protect onboarding, so
payment comes before the remaining setup steps.

1. `account_created`
2. `gbp_connect_started`
3. `business_connected`
4. `checkout_started`
5. `payment_succeeded`
6. `onboarding_step_completed` (steps 2–5)
7. `onboarding_completed`
8. `content_generated`
9. `content_published` (first successful publish is first value)

A report that places onboarding before payment is wrong for this application.

## Backend event contract

`analyticsEvents` is append-only. Events are written in the same transaction
as the business fact wherever possible. Each terminal fact has a deterministic
`dedupeKey`, so webhook retries, action retries and browser refreshes cannot
inflate counts.

Allowed events:

- `account_created`
- `gbp_connect_started`
- `gbp_connect_failed`
- `business_connected`
- `business_reconnected`
- `onboarding_step_completed`
- `onboarding_completed`
- `audit_completed`
- `content_generated`
- `content_published`
- `site_published`
- `checkout_started`
- `checkout_failed`
- `checkout_dismissed`
- `payment_succeeded`
- `payment_refunded`

Required common fields are event, occurredAt, source and dedupeKey. `userId` and
`businessId` are optional only because failure can happen before a business
exists. Revenue fields are integer paise and ISO currency. Metadata is a small,
non-PII record: content kind, onboarding step, plan, confirmation path or error
class. Never put an email, phone, business name, review text, address, Google
token, Razorpay signature or free-form provider response into analytics.

`analyticsDaily` and `analyticsTotals` are updated in the same transaction as a
new event. Dashboard summaries are bounded indexed reads; they do not scan the
event table or count with `.collect().length`.

## GA4 contract

GA tracks the marketing site and product routes, never shop microsites.
Automatic GA events remain enabled. Our explicit events are:

- `cta_click`: `cta_id`, `location`, `destination`
- `login_start`: `method`
- `begin_checkout`: standard GA event; `currency`, `value`, `items`
- `purchase`: standard GA event; `transaction_id`, `currency`, `value`, `items`

GA receives no direct identifiers or customer content. A pseudonymous analytics
ID may be configured for signed-in users only if the privacy policy says so;
no Convex document id is sent. The Convex ledger remains correct when GA is
blocked. Revenue in GA is for channel attribution only.

No pseudonymous ID is configured. The privacy policy (§7) states GA "is not
connected to your account", so `lib/ga.ts` has no `user_id` setter at all —
adding one would make that sentence false, and a missing function is a better
guarantee than a rule somebody has to remember.

The contract is enforced in code, not by convention. `lib/ga.ts` holds a
per-event parameter **allowlist** (a blocklist's failure mode is "we forgot to
ban this one", which here is a privacy incident) plus a value-level check that
drops anything shaped like an email, a phone number or a Convex document id
even when its key is allowed. Razorpay ids carry an underscore and mixed case,
so `order_…` survives as `transaction_id` while a bare 24-character lowercase
token does not.

Instrumentation is declarative. An anchor or button carrying
`data-analytics-event` plus `data-analytics-*` parameters is picked up by one
delegated capture-phase listener in `components/analytics.tsx`; markup cannot
widen the contract, because an unknown event name or parameter is refused
there. That listener, and every `gaEvent` call, is gated on the same
host-and-path check that governs page views, so a CTA rendered on a shop
microsite sends nothing.

Where the two payment events fire is load-bearing:

- `begin_checkout` is sent after `billing.createOrder` returns, using the
  **server's** authoritative amount and currency — never the price rendered on
  the card, which can differ when the ₹1 production-test allowlist changes.
- `purchase` is sent only after `verifyPayment` returns `paid`, i.e. after the
  server has checked Razorpay's signature and its own amount guard. Razorpay's
  browser handler firing is not proof of a sale. `transaction_id` is the
  Razorpay order id. A `sessionStorage` guard keyed on that id makes the event
  once-per-transaction, because `verifyPayment` answers `paid` again for an
  order already granted and GA counts a repeated `transaction_id` as a second
  sale.

## Admin access

The internal dashboard lives at `/admin/analytics`, outside the customer app's
paywall and narrow mobile shell. Every backing query
checks the signed-in user's verified email against `ANALYTICS_ADMIN_EMAILS` in
Convex. Hiding the navigation link is decoration, not authorization. A denied
query returns `Not found.` so the route does not advertise that an admin area
exists.

The dashboard has:

- summary cards: accounts, connected businesses, active plans, captured
  revenue, refunds, monthly run rate, first-value businesses;
- a selectable 7/30/90-day funnel with conversion and drop-off at each step;
- daily signup/connect/purchase/revenue trend;
- paginated business/customer table with contact identity, business, onboarding,
  connection, first value, plan and last activity;
- bounded recent event feed for debugging the funnel.

The route is a sibling of `/app`, not a child: `app/admin/layout.tsx` has its
own Convex Auth provider (`AdminConvexProviders`) with no `Paywall` — an
operator is staff, not a subscriber, and a plan check would lock the team out
of their own numbers — and no query cache, because warming reads that span the
whole customer base for a screen nobody is looking at is the wrong default.

`proxy.ts` redirects a signed-out visitor from `/admin` and `/admin/*` to
`/app/login`, and `/admin/` is disallowed in `app/robots.ts` with a `noindex`
on the layout. All three are tidiness. The authorization is `adminQuery`, and a
signed-in non-admin reaches the route and is told `Not found.` — which is the
intended outcome, not a gap.

Every `truncated` flag the backend returns is rendered as a visible "lower
bound, not a total" warning, and the run rate is labelled a run rate wherever
it appears.

## Existing-data backfill

Forward events are exact. Existing users predate the event ledger, so an
internal idempotent backfill derives only facts that remain trustworthy:

- account creation from `users._creationTime`;
- connection from `businesses._creationTime`;
- onboarding completion from `agentStartedAt`;
- checkout and payment from subscription rows;
- successful publishes from non-Google posts, uploaded photos and replies.

It must exclude Google-imported posts (`generatedBy === "google"`) and mirrored
photos without `storageId`. It must not invent old GBP failures or onboarding
step timestamps, because those facts were never stored.

## Interpretation rules

- A GA user is a browser estimate, not a customer.
- `payment_succeeded` is emitted only inside `markPaid` after the idempotency
  guard and amount/currency checks.
- First value means a successful Google publish, not generating a draft.
- A cron publish is product value; it is not human engagement. Source records
  owner/agent/system where the code knows it.
- Revenue is reported in paise internally and formatted as INR in the UI.
- A report hitting its safety cap must say it is truncated rather than silently
  presenting a partial number as exact.
