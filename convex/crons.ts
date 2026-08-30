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

// Three posts a week, planned ahead. This runs every morning and publishes
// whatever the plan says is due today — most mornings that is nothing.
// Posting daily on a small local listing reads as automated.
crons.daily(
  "publish scheduled posts",
  { hourUTC: 4, minuteUTC: 0 }, // 09:30 IST, as shops are opening
  internal.posts.publishDue,
);

// One photo a day reads like a shop someone is running. Thirty at once
// reads like a one-off.
crons.daily(
  "publish queued photo",
  { hourUTC: 11, minuteUTC: 30 }, // 17:00 IST
  internal.photos.publishDaily,
);

crons.weekly(
  "check keyword ranks",
  { dayOfWeek: "monday", hourUTC: 2, minuteUTC: 0 }, // 07:30 IST Monday
  internal.performance.checkAllRanks,
);

export default crons;
