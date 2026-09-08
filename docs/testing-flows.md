# Testing payments, email and messaging locally

Everything below runs against `npx convex dev` on the laptop. Nothing here
needs a Google listing; see `docs/local-testing.md` for the fake Google.

## Where to look

| What | Where |
|---|---|
| Every SMS / WhatsApp send and its Twilio outcome | `npx convex data messages` |
| Every email and its Resend outcome | `npx convex data emails` |
| Addresses we've stopped writing to (bounced / complained / invalid) | `npx convex data emailSuppressions` |
| Every Razorpay webhook, keyed by event id, with what we did | `npx convex data paymentEvents` |
| Orders, one row per attempt at a plan | `npx convex data subscriptions` |
| Refunds | `npx convex data refunds` |
| Post-generation runs (progress, stop requests, outcome) | `npx convex data postGenerations` |

With `OTP_DEV_ECHO=1` and no Twilio / Resend keys, every send is logged
as `skipped` with the reason, and sign-in codes are printed in the
`npx convex dev` log. Add the keys to `convex/.env.local` and push
(`npm run env:push -- convex/.env.local`) to send for real.

## Payments

Open `/app/billing`, pick a plan, and use Razorpay's test cards / UPI
(`success@razorpay` succeeds, `failure@razorpay` fails).

| Scenario | How | Expect |
|---|---|---|
| Success | pay with `success@razorpay` | row → `paid`, receipt email row, plan shows active, `/app` unlocked |
| Declined | pay with `failure@razorpay` or a test card that declines | Checkout stays open for a retry; row → `attempted` with `failureReason`; one "didn't go through" email per order |
| Cancelled | close Checkout | row stays `created`; plan picker back; reopening reuses the same order for 30 min |
| Abandoned | close the tab mid-Checkout, come back | same order reused; after 24 h the sweep marks it `expired` |
| Refresh mid-payment | pay, then refresh before the redirect | `status.pending` picks it up; "Waiting for Razorpay" with a "Check payment status" button |
| Webhook before the browser | `RAZORPAY_WEBHOOK_ONLY=1` on Convex, pay, then `npm run webhook:fake -- --order order_X --payment pay_X` | browser shows "waiting"; the webhook grants; page flips by itself |
| Webhook after the browser | pay normally, then fire the fake webhook for the same order | answered `processed` with note `paid (already)`; no second period |
| Duplicate webhook | fire the same command twice with `--event-id evt_1` | second answers `duplicate` |
| Bad signature | `--bad-signature` | 400, nothing written |
| Amount mismatch | `--amount 100` | row → `mismatch`, nothing granted, screen says to contact support |
| Currency mismatch | (unit test `convex/billing.test.ts`) | same as above |
| Authorized, not captured | `--event payment.authorized` | row → `authorized`; the 15-minute reconcile (or "Check payment status") asks Razorpay to capture |
| Failure after capture | captured, then `--event payment.failed` | ignored: `paid` stays `paid` |
| Partial refund | `--event refund.processed --payment pay_X --amount 50000` | row → `partially_refunded`, access stays, refund email |
| Full refund | same with the full amount (or two partials adding up) | row → `refunded`, `expiresAt` = now, access ends |
| Failed refund | `--event refund.failed` | refund row `failed`, plan untouched |
| Retry after failure | after a decline, pay again | same order, `attempts` counts up, then `paid` |
| Paying while active | "Pay for another period now" on the active screen | new period starts when the current one ends |
| Support refund | `npx convex run billing:issueRefund '{"paymentId":"pay_X","amountPaise":50000,"reason":"..."}'` | refund created at Razorpay; the webhook finishes it |
| Comp a shop | `npx convex run billing:grantComp '{"email":"x@y","days":365,"reason":"..."}'` | `comp` row, access granted |

Unit tests for the idempotent core: `npm test` (`convex/billing.test.ts`).

## Email (Resend)

| Flow | Trigger | Template / dedupe key |
|---|---|---|
| Sign-in code | email OTP on `/app/login` | `otp:<email>:<code>` |
| Welcome | first ever sign-in (any method) | `welcome:<userId>` |
| Setup complete | "save & finish" on step 6, first time only | `setup_complete:<businessId>` |
| Receipt | payment captured (browser or webhook, whichever wins) | `receipt:<orderId>` |
| Payment failed | first failed attempt on an order | `payment_failed:<orderId>` |
| Refund | `refund.processed` | `refund:<refundId>` |
| Plan ending in ≤7 days | daily 09:30 IST cron | `plan_expiring:<subscriptionId>` |
| Plan ended | daily cron, day after expiry | `plan_expired:<subscriptionId>` |
| Posts to approve | Sunday top-up cron wrote drafts | `posts_awaiting_approval:<runId>` |
| Google refused a post | scheduled publish failed | `post_failed:<postId>:<ts>` |
| Review reply held for approval | review sync held a low-star reply | `reviews_need_approval:<businessId>:<day>` |
| Google disconnected | Settings → disconnect | `google_disconnected:<userId>:<ts>` |
| Signed out everywhere | Settings → sign out of all devices | `signed_out_everywhere:<userId>:<ts>` |

Where the address comes from: the account's email, else the listing's
email. With neither, a `skipped` row is written so the gap is visible.

Bounces and complaints: point a Resend webhook at
`<CONVEX_SITE_URL>/resend/webhook` with `RESEND_WEBHOOK_SECRET` set.
`email.bounced` / `email.complained` add the address to
`emailSuppressions`, after which every send to it is `skipped`.

To force a resend of a deduped email in testing, delete its row from
`emails` (a `failed` row is retried automatically on the next trigger).

Only a Resend complaint about the *recipient* (`Invalid \`to\` field`,
422) suppresses an address. A bad `from` or an unverified domain is our
problem and never locks the owner out. If an address was suppressed by
mistake:

```
npx convex run email:unsuppress '{"email":"owner@example.com"}' [--deployment <name>]
```

## SMS / WhatsApp (Twilio)

| Flow | Channel | Dedupe |
|---|---|---|
| Sign-in code | SMS | one per code |
| Review invite to a customer (`dashboard.addCustomer`) | WhatsApp, falling back to SMS | one per customer per day per channel |
| Plan ending / ended | SMS to the owner | one per subscription |

Invalid numbers are refused before Twilio is called. Twilio 4xx (bad
number, opted out, region not enabled) is `failed` with Twilio's code;
429 / 5xx / network is retried three times (10 s, 1 min, 5 min). A
sign-in code that can't be sent *now* surfaces as an error on the login
screen rather than a silent retry. Delivery receipts land via
`<CONVEX_SITE_URL>/twilio/status` (signature-checked) once the
deployment has a public URL; locally rows stop at `sent`.

## Posts

Generate → Review → Approve → Schedule → (cron 11:00 IST Mon/Wed/Fri) Publish.

- `posts.startGeneration` opens a run and schedules `runGeneration`; a
  second click while one runs is refused.
- "Stop generating" sets `cancelRequestedAt`; the run stops between posts.
- A run with no heartbeat for 4 minutes is shown as timed out and a new
  one can start.
- `schedulePost` / `publishPost` refuse anything not `approved`.
- The Sunday cron only writes drafts and emails the owner.
