import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/app/login"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const signedIn = await convexAuth.isAuthenticated();

  if (isSignInPage(request) && signedIn) {
    return nextjsMiddlewareRedirect(request, "/app");
  }
  if (!isSignInPage(request) && !signedIn) {
    return nextjsMiddlewareRedirect(request, "/app/login");
  }
});

/**
 * Only the product routes. The marketing page at / never runs this,
 * so it stays static and independent of auth.
 */
export const config = {
  matcher: ["/app", "/app/(.*)"],
};
