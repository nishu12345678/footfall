# What runs on a schedule, when, and why

footfall does most of its work while nobody is looking. This page lists
every scheduled job (cron) in the app — what it does, when it runs, and
why it exists. Times are given in IST first because that is where our
shops are.

All of these are defined in one file: `convex/crons.ts`. A job runs once
for **every connected shop** unless said otherwise. If a job fails for
one shop (say, Google is down), it moves on to the next shop and tries
again at its next scheduled time — nothing piles up.

---

## The daily rhythm

| IST time | Job | What it does |
|---|---|---|
| 02:00 | Expire stale orders | Closes payment orders nobody finished |
| 07:00 | Sync performance | Pulls views / calls / directions from Google |
| 07:30 Mon | Check keyword ranks | Weekly: where each shop ranks on Google |
| 08:00 | Sync photos | Copies the Google gallery down to us |
| 08:30 Sun | Top up the post plan | Weekly: drafts next week's posts |
| 09:30 | Plan expiry reminders | Warns owners whose plan is about to end |
| 11:00 | Publish scheduled posts | Puts today's approved post on Google |
| 17:00 | Publish queued photo | Uploads one photo (Mon/Wed/Fri/Sat only) |
| every 4 hrs | Sync reviews | Pulls new reviews, drafts replies |
| every 15 min | Reconcile payments | Double-checks open orders with Razorpay |

---

## Each job, in plain words

### Sync performance — daily, 07:00 IST

Pulls yesterday's numbers from Google for every shop: how many people
saw the listing, called, or asked for directions. Google gives us this
data for free, so we take it every day. This is what fills the chart on
the Performance screen.

### Sync reviews — every 4 hours

Checks Google for new reviews on every shop. New praise gets a reply
drafted (and published on its own if the owner allows it); anything
three stars or below gets a careful draft that **waits for the owner**.
Why every 4 hours: replying within a day genuinely helps ranking, and a
shop owner cannot sit and watch Google all day. Four hours is the widest
gap that still keeps every reply inside the same day.

### Publish scheduled posts — daily, 11:00 IST

Looks at each shop's post plan and publishes whatever is due **today**.
Most days that is nothing — the plan aims for about three posts a week,
because posting every single day on a small shop's listing looks
robotic. Only posts the owner approved ever go out.

Small detail with a story behind it: this job must run *after* the
posting slot hour, not before. It once ran an hour early, found nothing
due yet, and everything published a day late.

### Sync photos — daily, 08:00 IST

Reads the shop's photo gallery back **from** Google and updates our
copy, including deleting photos the owner removed on Google. Without
this, a photo deleted on Google could stay visible on the shop's public
website here. That actually happened — a cafe's site showed a dental
clinic photo — which is why this job exists.

It deliberately runs at 08:00, half an hour after the Monday rank check
starts, so two heavy jobs don't hammer the network at the same moment.
It also runs *before* the photo upload job later in the day, so upload
decisions are made against a fresh copy of the gallery.

### Publish queued photo — daily at 17:00 IST, acts Mon / Wed / Fri / Sat

Uploads one photo from the shop's queue to Google — but only four days
a week. Four photos a week reads like a shop someone is actually
running. Thirty photos dumped at once reads like a bot, and Google has
been known to stop accepting uploads from a listing for weeks over it.
The job itself runs daily; it simply does nothing on the other days.

### Top up the post plan — weekly, Sunday 08:30 IST

Writes next week's post drafts before the current plan runs out, so a
listing never goes quiet. Google posts fade from view after about seven
days, so a steady drip matters more than any single post. These are
**drafts only** — the owner approves and schedules them; nothing here
publishes by itself.

### Check keyword ranks — weekly, Monday 07:30 IST

For every shop, searches Google for each tracked keyword and records
where the shop appears. "Near me" keywords are searched from five points
spread across the shop's area (people ask those from wherever they are
standing); city-name keywords are searched once, from the shop (the city
has roughly one answer). This is what
keeps the rank badges and "found in X of 5 spots" lines on the
Performance screen at most a week old.

Why only weekly: every single location search here costs real money (one
DataForSEO Maps request each). Google's own performance numbers are free, so
those sync daily; rankings are paid, so they sync weekly. The owner can always
press "Check rankings" for a fresh look, and the 9-point map is only
ever run by hand — no cron touches it.

### Plan expiry reminders — daily, 09:30 IST

Finds plans that are about to run out and sends the owner a warning.
This matters more here than in most apps: footfall never auto-debits
anyone, so this reminder is the **only** warning an owner gets before
the agent stops working. (Accounts on the free-access list have no plan
rows, so they are never nagged.)

### Reconcile open payments — every 15 minutes

Takes every payment order that is still open and asks Razorpay what
actually happened to it. Both the webhook and the browser hand-back can
miss a payment (closed laptop, dropped connection), and this is the
safety net that makes sure a paid owner always gets what they paid for,
within minutes, no matter what failed.

### Expire stale orders — daily, 02:00 IST

Closes payment orders that were opened but never finished, once they
are a day old. Purely housekeeping: it stops the billing screen from
offering "check status" on an order that will never complete.

---

## Things that look scheduled but are not crons

- **Performance auto-refresh on screen open** — opening the Performance
  screen refreshes Google's numbers if they are more than 30 minutes
  old. That is the page itself, not a cron.
- **The first rank check** — runs once, automatically, when a shop that
  has keywords has never been checked. After that, rank checks are the
  Monday cron or the owner's own button press.
- **The 9-point rank map ("Where do I rank around here?")** — never runs
  on a schedule. It costs 9 paid searches per keyword, so it only runs
  when the owner explicitly asks, and the result is stored and re-shown
  for free until they press "Check again now".

## The pattern behind the times

Three rules explain almost every choice above:

1. **Free data syncs often, paid data syncs rarely.** Google's own
   numbers are free → daily. Reviews are free → every 4 hours. Rank
   checks cost per search → weekly, and the densest check is manual
   only.
2. **Anything that publishes is throttled to look human.** Three posts
   a week, four photos a week, spread out — because a listing that
   updates like a machine gets treated like one, by customers and by
   Google.
3. **Money paths get belt and braces.** Payments are checked every 15
   minutes against Razorpay's own records, and expiry warnings go out
   daily, because nothing in footfall auto-debits and nothing should
   silently lapse either.
