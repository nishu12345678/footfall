/**
 * If this file is missing or wrong, the app is silently always signed out
 * with no error anywhere. CONVEX_SITE_URL is set by Convex automatically.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
