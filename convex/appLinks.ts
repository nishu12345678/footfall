/**
 * The native app (footfall_app, Flutter) comes back from a browser hop —
 * Google sign-in, Google Business Profile consent — on its own URL scheme,
 * not on SITE_URL. Only this exact scheme is trusted as a return address;
 * anything else still has to be on the web app's own origin.
 */
export const APP_SCHEME = "footfall";

export function isAppLink(url: string): boolean {
  return url.startsWith(`${APP_SCHEME}://`);
}
