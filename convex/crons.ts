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

// A listing that posts every day reads as active to Google, and to anyone
// who lands on it. This is the agent's main job.
crons.daily(
  "publish daily post",
  { hourUTC: 4, minuteUTC: 0 }, // 09:30 IST, as shops are opening
  internal.posts.postDaily,
);

crons.weekly(
  "check keyword ranks",
  { dayOfWeek: "monday", hourUTC: 2, minuteUTC: 0 }, // 07:30 IST Monday
  internal.performance.checkAllRanks,
);

export default crons;
