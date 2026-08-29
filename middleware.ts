import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/app/login"]);
const isProductRoute = createRouteMatcher(["/app", "/app/(.*)"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
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
 * can never be taken down by an auth problem.
 */
export const config = {
  matcher: ["/app", "/app/(.*)", "/api/auth(.*)"],
};
