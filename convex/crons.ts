import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Google's performance data costs nothing to read, so it refreshes nightly
 * for every connected shop. Ranking costs one SerpApi search per keyword
 * per shop, so it runs weekly instead — the owner can always run it by hand.
 */
crons.daily(
  "sync gbp performance",
  { hourUTC: 1, minuteUTC: 30 }, // 07:00 IST
  internal.performance.syncAllMetrics,
);

// Reviews, every four hours. Replying inside a day is worth roughly a
// position and a half in the local pack, and a shop owner cannot watch for
// them. Four hours is the widest gap that still lands well inside the day.
crons.interval(
  "sync gbp reviews",
  { hours: 4 },
  internal.reviews.syncAllReviews,
);

// Three posts a week, planned ahead. This runs every morning and publishes
// whatever the plan says is due today — most mornings that is nothing.
// Posting daily on a small local listing reads as automated.
//
// It has to run AFTER the slot hour, not before. Slots are 05:00 UTC; a run
// at 04:00 saw nothing due and picked the post up the following morning
// instead, so everything published a day late.
crons.daily(
  "publish scheduled posts",
  { hourUTC: 5, minuteUTC: 30 }, // 11:00 IST, half an hour after the slot
  internal.posts.publishDue,
);

// Four photos a week reads like a shop someone is running. Thirty at once
// reads like a one-off, and Google can stop accepting uploads for a
// fortnight over it. The run is daily; the action itself keeps to Mon,
// Wed, Fri and Sat.
crons.daily(
  "publish queued photo",
  { hourUTC: 11, minuteUTC: 30 }, // 17:00 IST
  internal.photos.publishDaily,
);

// Refills the content plan before it runs out, so the profile never goes
// quiet. Google posts lose prominence after about seven days.
crons.weekly(
  "top up the post plan",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 }, // 08:30 IST Sunday
  internal.posts.topUpPlans,
);

// Nothing auto-debits, so the only warning an owner gets that their plan
// is about to lapse is this one.
crons.daily(
  "warn about plans running out",
  { hourUTC: 4, minuteUTC: 0 }, // 09:30 IST
  internal.billing.remindExpiring,
);

crons.weekly(
  "check keyword ranks",
  { dayOfWeek: "monday", hourUTC: 2, minuteUTC: 0 }, // 07:30 IST Monday
  internal.performance.checkAllRanks,
);

export default crons;
