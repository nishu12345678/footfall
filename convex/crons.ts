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

crons.weekly(
  "check keyword ranks",
  { dayOfWeek: "monday", hourUTC: 2, minuteUTC: 0 }, // 07:30 IST Monday
  internal.performance.checkAllRanks,
);

export default crons;
