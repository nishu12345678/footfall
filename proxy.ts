import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/app/login"]);
const isProductRoute = createRouteMatcher(["/app", "/app/(.*)"]);

/**
 * The internal analytics dashboard.
 *
 * A signed-out visitor is sent to the product's own sign-in page — there is
 * only one account system, and a second login screen for staff would be a
 * second thing to keep secure for no benefit.
 *
 * This is NOT the authorisation, and the difference matters. All this can
 * establish is "somebody is signed in"; whether that somebody may read the
 * customer table is decided in convex/access.ts, where `adminQuery` checks
 * the signed-in user's VERIFIED email against ANALYTICS_ADMIN_EMAILS and
 * refuses with "Not found." otherwise. A signed-in non-admin therefore
 * reaches this route and is told nothing is here, which is the intended
 * outcome: the redirect is a convenience, the backend is the lock.
 */
const isAdminRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isAdminRoute(request)) {
    if (!(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/app/login");
    }
    return;
  }

  // Everything outside /app — including Convex Auth's own /api/auth endpoint —
  // passes straight through. The middleware still has to *run* for /api/auth,
  // which is why the matcher below includes it.
  if (!isProductRoute(request)) return;

  const signedIn = await convexAuth.isAuthenticated();

  if (isSignInPage(request) && signedIn) {
    return nextjsMiddlewareRedirect(request, "/app");
  }
  if (!isSignInPage(request) && !signedIn) {
    return nextjsMiddlewareRedirect(request, "/app/login");
  }
});

/**
 * The marketing page at / is deliberately absent, so it stays static and
 * can never be taken down by an auth problem. So are the shop microsites
 * at /s/<slug>, for the same reason — a customer's website must not depend
 * on our auth system being up.
 */
export const config = {
  matcher: [
    "/app",
    "/app/(.*)",
    "/admin",
    "/admin/(.*)",
    "/api/auth(.*)",
    "/api/google(.*)",
  ],
};
