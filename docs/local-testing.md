# Testing footfall locally

You can run the whole product on a laptop without a Google Business Profile,
without a Google Cloud project, and without a rupee moving. This page is how.

## The two backends

| Piece | Where it runs | Config file |
|---|---|---|
| Next.js app | `npm run dev` (or `docker compose up`) on port 3000 | `.env.local` |
| Convex backend | `npx convex dev` on the host, local deployment on ports 3210 (API) and 3211 (HTTP) | Convex env vars, set with `npx convex env set KEY value` |

`npx convex env set` is the only thing that puts a value on the backend.
Writing it into `.env.convex` alone does nothing; that file is your own
notebook. `.env.local` is read by Next automatically.

## Which keys you need

| Key | Where | Needed for | Without it |
|---|---|---|---|
| `OTP_DEV_ECHO=1` | Convex | Signing in with phone or email while MSG91 and Resend are unset. The code is printed in the `npx convex dev` log. | You cannot sign in. |
| `GOOGLE_MOCK_ENABLED=1` | `.env.local` | The fake Google at `/api/mock/google` | Route answers 404 |
| `GOOGLE_API_MOCK_URL=http://127.0.0.1:3000/api/mock/google` | Convex | Backend talks to the fake Google | Backend calls the real Google APIs, which fail without a listing |
| `SITE_URL=http://localhost:3000` | Convex | Where the OAuth callback sends the browser back | Lands on the wrong host |
| `NEXT_PUBLIC_SITE_URL=http://localhost:3000` | `.env.local` | Shop links, the copy button and canonical tags point at your own host. `NEXT_PUBLIC_SITE_DOMAIN` can stay set; subdomain links are only used when the app is served from that domain. | Links point at production |
| `RAZORPAY_KEY_ID` (`rzp_test_…`), `RAZORPAY_KEY_SECRET` | Convex | Paying for a plan in test mode | Billing page cannot create an order |
| `RAZORPAY_WEBHOOK_SECRET` | Convex | The webhook path, real or faked | Webhook returns 500 |
| `OPENAI_API_KEY` | Convex | Writing posts, review replies, keyword ideas, the shop site, post images | Those buttons error; everything else works |
| `FIRECRAWL_API_KEY` | Convex | Reading the shop's website for the report and for suggestions | Website check reports nothing |
| `SERPAPI_KEY` | Convex | Rank checks and the geo-grid. Every pin per keyword is one paid search, so leave this blank unless you are testing ranking. | Rank check errors; the rest of Performance works from the mock's metrics |
| `DATAFORSEO_AUTH` | Convex | Keyword search volumes | Keywords show without volumes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Convex | Only for the real Google consent screen. Not needed with the mock. | Nothing, with the mock on |
| `MSG91_*`, `AUTH_RESEND_KEY` | Convex | Real SMS and email codes | Nothing, with `OTP_DEV_ECHO` on |

## Turn the fake Google on

```
echo 'GOOGLE_MOCK_ENABLED=1' >> .env.local
npx convex env set GOOGLE_API_MOCK_URL http://127.0.0.1:3000/api/mock/google
```

Restart `npm run dev` so Next picks up the new variable. Keep
`npx convex dev` running throughout: it is what pushes the code on this
branch to the local backend, and the backend reads the variable on every
call, so no restart is needed on that side. Check both halves:

```
curl -s http://127.0.0.1:3000/api/mock/google/_control/state
npx convex env get GOOGLE_API_MOCK_URL
```

If connect fails with *"The fake Google is on in .env.local but not on
the backend"*, the second half is missing: run the `env set` line again
from the repo root and check `.env.local` names the same deployment that
`npx convex dev` is serving.

What you get is one account managing one listing, Glow Salon in Thane,
with 8 reviews (4 unanswered, one of them a 2-star complaint that the
agent will hold for approval), 6 photos, 2 old posts, and a month of
views, calls and direction requests. Photos are drawn by the mock, so
they load without internet.

The mock keeps state in memory. A post you publish shows up in the next
sync; a reply lands on its review. `POST _control/reset` starts over,
`POST _control/revoke` makes Google refuse everything the way it does
when an owner removes the app from their account, and `_control/restore`
undoes that. The dev server restarting also resets it.

Never set `GOOGLE_API_MOCK_URL` on a cloud deployment. The Next route
refuses to serve unless `GOOGLE_MOCK_ENABLED=1`, so production meets a
404 even if it were set, but there is no reason to find out.

## Walk through the product

1. Open `http://localhost:3000/app/login`. Enter any Indian mobile number.
   The 4-digit code is in the `npx convex dev` terminal, on a line
   starting `[otp-dev-echo]`.
2. Press **connect Google**. With the mock on there is no consent screen;
   you land on the processing page and Glow Salon is linked.
3. **Continue setup** sends you to onboarding step 2, which is behind the
   plan, so you are bounced to the free report at `/app/report`. That is
   the product working as designed: connect and the report are free, the
   agent is paid.
4. **See the plans** takes you to `/app/billing`. Pay with Razorpay's test
   mode (next section). You are now on a plan.
5. Onboarding steps 2 to 6 and the dashboard are open. Reviews, photos
   and performance are already populated from the mock. Posts, review
   replies and the shop site need `OPENAI_API_KEY`.

Anything that goes wrong on the backend is in the `npx convex dev`
terminal. To start again from nothing:

```
npx convex run admin:wipe '{"includeAuth": true}'
curl -s -X POST http://127.0.0.1:3000/api/mock/google/_control/reset
```

## Razorpay in test mode

Your keys must start with `rzp_test_`. Checkout then opens in test mode
and no card is charged.

- **Card:** `4111 1111 1111 1111`, any future expiry, any CVV, any OTP on
  the test bank page.
- **UPI:** `success@razorpay` succeeds, `failure@razorpay` fails.
- **Netbanking:** pick any bank, press Success.

On success the browser hands the signature back and the backend marks
the order paid. Confirm with `npx convex data subscriptions`: the row is
`status: paid`, `confirmedBy: browser`.

### The webhook

The browser hand-back is the fast path. The webhook is the one that has
to be right, because it grants access even if the customer's phone dies
between paying and the redirect. Razorpay cannot reach `127.0.0.1`, so
fire one yourself:

1. Open `/app/billing`, choose a plan, and close Checkout without paying.
   That leaves a `created` row.
2. `npx convex data subscriptions` and copy its `razorpayOrderId`.
3. Send a signed `payment.captured` for it:

   ```
   npm run webhook:fake -- --order order_XXXXXXXXXXXX
   ```

   Expect `200 ok` and the row flipping to `paid` with
   `confirmedBy: webhook`.

4. Run it again. The period must not double; that is the idempotency
   the audit relies on.
5. `npm run webhook:fake -- --order order_XXXX --bad-signature` must
   answer `400 bad signature` and change nothing.

The script reads the secret from `RAZORPAY_WEBHOOK_SECRET` in your shell
or from `.env.convex`, and the target from `NEXT_PUBLIC_CONVEX_SITE_URL`
in `.env.local`. Both can be overridden with `--secret` and `--url`.

### Webhook-only mode: the production path, live

In production the browser hand-back and the webhook race, and either one
grants the plan. To watch the webhook do it alone with a real test-mode
payment, tell the backend to leave the grant to the webhook:

```
npx convex env set RAZORPAY_WEBHOOK_ONLY 1
```

Now pay on `/app/billing` as usual. Checkout succeeds, the backend
verifies the signature, but the page stays put and shows the order and
payment ids with "waiting for Razorpay's confirmation". The row is still
`created`. Fire the webhook for that order yourself, either with the
script or with raw curl shaped exactly like Razorpay's delivery:

```
SECRET='<RAZORPAY_WEBHOOK_SECRET>'
ORDER='order_...'      # from the billing page
PAYMENT='pay_...'      # from the billing page
BODY=$(printf '{"entity":"event","account_id":"acc_test","event":"payment.captured","contains":["payment"],"payload":{"payment":{"entity":{"id":"%s","entity":"payment","amount":199900,"currency":"INR","status":"captured","order_id":"%s","method":"upi","captured":true}}},"created_at":%s}' "$PAYMENT" "$ORDER" "$(date +%s)")
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -i -X POST http://127.0.0.1:3211/razorpay/webhook \
  -H 'content-type: application/json' \
  -H "x-razorpay-signature: $SIG" \
  -H "x-razorpay-event-id: evt_local_$(date +%s)" \
  --data-binary "$BODY"
```

The page flips to "Your plan is running" on its own the moment the row
turns paid; it is a live query. Unset the switch afterwards:

```
npx convex env remove RAZORPAY_WEBHOOK_ONLY
```

Never set it on production. A paying customer would sit on the billing
page until Razorpay's webhook arrived.

If you would rather have Razorpay deliver real test-mode webhooks, expose
port 3211 with a tunnel (ngrok, cloudflared) and register
`https://<tunnel>/razorpay/webhook` under **Settings → Webhooks** in the
Razorpay dashboard, in test mode, with the same secret.

### Starting over

`admin:wipe` clears every app table, including subscriptions, the auth
tables, and file storage, so the next run begins at sign-in:

```
npx convex run admin:wipe '{"includeAuth": true}'
curl -s -X POST http://127.0.0.1:3000/api/mock/google/_control/reset
```

## Tests

```
npm test
```

`convex/tenancy.test.ts` proves one shop can never touch another's rows.
`convex/googleMock.test.ts` drives the real Convex code against the fake
Google: connect, sync, publish a post, reply to a review, refresh a token,
and the revoked-grant failure. If you change a shape in
`lib/google-mock.ts`, this is what tells you whether the app still parses
it.

Typecheck needs Next's generated types first:

```
npx next typegen && npx tsc --noEmit
```
