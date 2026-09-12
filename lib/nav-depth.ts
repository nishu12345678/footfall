/**
 * How many in-app navigations this tab has made since it loaded.
 *
 * `document.referrer` does not change on client-side route changes, so it
 * cannot tell "the user navigated here from another screen" apart from "the
 * user landed here fresh". This counter can: the tracker bumps it on every
 * route change, and the Back button only walks history when at least one
 * in-app navigation actually happened. Module state resets on a full page
 * load, which is exactly the moment history stops being ours.
 */
let navigations = 0;

export function noteNavigation(): void {
  navigations += 1;
}

/**
 * Called just before a `router.replace(...)` redirect. A replace swaps the
 * current history entry instead of adding one, so the pathname change the
 * tracker is about to count must not be treated as walkable history —
 * otherwise Back from the redirect target would leave the app entirely.
 */
export function noteRedirect(): void {
  navigations -= 1;
}

/** True once the user has navigated within the app in this tab. */
export function hasInAppHistory(): boolean {
  return navigations > 1;
}
