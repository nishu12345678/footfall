# Wiping and clearing data

Every wipe/clear helper lives in `convex/admin.ts`. They are all
**internal** functions — nothing in the browser can reach them; they run
only with `npx convex run` under deployment credentials.

## Ground rules

- **Aim before you fire.** `npx convex run` targets whatever
  `CONVEX_DEPLOYMENT` in `.env.local` says. Pass an explicit
  `--deployment precious-lobster-374` (stage/dev) to be safe. Never pass
  `--prod` to anything on this page unless you are certain and it has a
  dry run you have already read.
- **Dry run first.** The scoped removals (`eraseUser`, `removeBusiness`,
  `resetBusinessContent`) default to `dryRun: true` — the first run only
  counts and returns the blast radius. Nothing is deleted until you pass
  `"dryRun": false`.
- **Files are covered.** Each helper also deletes the storage files its
  rows point at (logos, post images, photos). Google-hosted images are
  never ours and are never touched.

## Look before deleting

```bash
# Row counts for every table — the deployment at a glance
npx convex run admin:counts --deployment precious-lobster-374

# The first signed-up owner (userId + shop name), for hand-run actions
npx convex run admin:firstOwner --deployment precious-lobster-374
```

## Erase ONE user — `admin:eraseUser`

"Delete my account" of last resort. Finds the user by email, phone or id
and removes **everything they left behind**: every business they own and
all its content (posts, photos, reviews, keywords, site, metrics,
rankings, website checks…), review-invite SMS/WhatsApp logs, their Google
connection and tokens, subscriptions + payment events + refunds, email
logs and suppressions, sign-in accounts, sessions, OTP codes, rate
limits, the user row, and their files.

```bash
# 1. count what would go (dryRun defaults to true)
npx convex run admin:eraseUser '{"email":"owner@example.com"}' --deployment precious-lobster-374

# 2. actually delete
npx convex run admin:eraseUser '{"email":"owner@example.com","dryRun":false}' --deployment precious-lobster-374

# by phone (any format; digits are compared) or by user id
npx convex run admin:eraseUser '{"phone":"+91 93191 02143","dryRun":false}'
npx convex run admin:eraseUser '{"userId":"<users id>","dryRun":false}'
```

Note: subscriptions and refunds go too. If the money trail matters,
export it first — Razorpay keeps its own copy either way.

## Remove ONE business — `admin:removeBusiness`

Deletes one business row and everything hanging off it, plus the owner's
Google connection. The owner's login survives unless `includeUser` is
set (use `eraseUser` instead when the person should go too).

```bash
npx convex run admin:removeBusiness '{"businessId":"<id>"}'                # dry run
npx convex run admin:removeBusiness '{"businessId":"<id>","dryRun":false}' # delete
```

## Reset a business's CONTENT — `admin:resetBusinessContent`

Keeps the business row, its Google link, its selection and its plan —
wipes only generated content (site, offerings, keywords, posts, photos,
reviews cache, metrics, website checks, logo) and rewinds onboarding to
step 2 so everything regenerates for the listing the row actually names.

```bash
npx convex run admin:resetBusinessContent '{"businessId":"<id>"}'                # dry run
npx convex run admin:resetBusinessContent '{"businessId":"<id>","dryRun":false}' # reset
```

## Wipe the WHOLE deployment — `admin:wipe`

Back to factory-empty: every app table, every auth table (signs everyone
out), every stored file. **No dry run — it deletes immediately.** For
dev/stage resets only; never point this at prod.

```bash
npx convex run admin:wipe --deployment precious-lobster-374          # everything
npx convex run admin:wipe '{"includeAuth":false}'                    # keep logins, wipe app data
```

## Small brushes

```bash
npx convex run admin:clearPosts    # just the posts (re-run the planner fresh)
npx convex run admin:clearPhotos   # just the photo cache (re-pull at new size)
```

## What covers what

| | eraseUser | removeBusiness | resetBusinessContent | wipe |
|---|---|---|---|---|
| Scope | one person | one business | one business's content | everyone |
| Business row | ✓ deleted | ✓ deleted | kept | ✓ deleted |
| Posts/photos/reviews/site/keywords/checks | ✓ | ✓ | ✓ | ✓ |
| Google account + tokens | ✓ | ✓ | kept | ✓ |
| Subscriptions / payments / refunds | ✓ | kept | kept | ✓ |
| SMS/WhatsApp + email logs | ✓ | kept | kept | ✓ |
| Login (user, sessions, OTPs) | ✓ | only with `includeUser` | kept | ✓ (unless `includeAuth:false`) |
| Stored files | ✓ | ✓ | ✓ | ✓ |
| Dry run first | ✓ default | ✓ default | ✓ default | ✗ immediate |
