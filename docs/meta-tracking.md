# Meta website-visit tracking

This integration is prepared for the **Footfall** ad account (`4719768051615822`),
within business portfolio `1640346520375634`, and `footfall.zone`.
It measures **website PageView events**, not physical store visits, leads,
signups or purchases. No dataset ID or secret is committed.

## What the code does

- Loads Meta Pixel only after the visitor chooses **Allow ad measurement**.
- Sends the same `PageView` with the same event ID through the browser Pixel
  and `/api/meta/events` to CAPI. This is Meta's event deduplication key.
- Covers only `/`, `/privacy` and `/terms` on `footfall.zone` and
  `www.footfall.zone`. It excludes the app, admin, customer sites and previews.
- Sends browser information, a Vercel-provided IP when available, and valid
  `_fbp`/`_fbc` cookies when present. It does not send form fields, login details,
  Google data or report contents. CAPI receives no query string or referrer;
  the browser Pixel itself can see the current URL and referrer. Do not put
  customer details or authentication tokens in public marketing URLs.
- Turns off automatic Pixel configuration. Also leave automatic advanced
  matching and automatic events disabled in Events Manager.
- Stores the visitor's preference for 180 days. **Ad privacy settings** allows
  withdrawal; the browser is revoked, Meta cookies are removed, and the server
  rejects requests without the grant cookie. No tracking image bypass is used.
- CAPI is independent of the Pixel script loading, so a blocked vendor script
  does not prevent an opted-in pageview being sent by the server.

## Activation (not completed by committing this code)

1. In Events Manager, create or select the correct dataset. The prepared name
   is **Footfall — footfall.zone**. Dataset creation presents Meta's Business
   Tools Terms; the business owner must accept or explicitly authorize this.
2. Associate the dataset with the Footfall ad account. Choose Meta Pixel plus
   Conversions API and direct/manual integration for this custom Next.js app.
3. Obtain a CAPI access token through Meta's supported setup. Store it only in
   Vercel's server environment. Do not put it into GitHub, chats, screenshots,
   URLs, browser code or any variable beginning `NEXT_PUBLIC_`.
4. In the existing Vercel project's **Production** environment, configure:

   | Variable                    | Value                                                                                          |
   | --------------------------- | ---------------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_META_PIXEL_ID` | The actual dataset/Pixel ID from Meta                                                          |
   | `META_CAPI_ACCESS_TOKEN`    | Server-side access token                                                                       |
   | `META_GRAPH_API_VERSION`    | A currently supported version from Meta's setup documentation, e.g. `v25.0` if still supported |
   | `META_TEST_EVENT_CODE`      | Temporary code from Events Manager > Test events                                               |

   Do not copy these settings into Preview/Development. Rebuild after changing
   the public Pixel ID: Next.js embeds it at build time. The server will return
   503 if its configuration is incomplete; the Pixel can still function alone.

5. Deploy only after the dataset, approved data sharing, privacy text and
   credentials are ready. Configure a Vercel Firewall rate-limit rule for
   `POST /api/meta/events` appropriate to expected traffic. Origin/consent
   checks reject browser cross-site requests but do not authenticate arbitrary
   HTTP clients; the endpoint is not a bot-proof analytics ledger.

## Verify on the real domain

1. With fresh cookies, no Meta script or CAPI request should occur before a
   choice. **No thanks** must keep both off.
2. Allow measurement. Verify one browser `PageView` and one server `PageView`
   with identical event IDs in Test events, and confirm deduplication. Inspect
   event matching quality and diagnostics. Cookies may be absent on the first
   server request before the Pixel finishes loading; never invent an `_fbc`.
3. Navigate to privacy and terms, then back home: one PageView per navigation.
   Verify no events on `/app`, `/admin`, `/s/...` or shop subdomains.
4. Revoke through **Ad privacy settings**, navigate again and confirm silence.
5. Remove `META_TEST_EVENT_CODE`, redeploy and verify real event receipt.
6. Keep the current campaign unchanged until this is verified. Website traffic
   reporting and conversion optimization are separate campaign settings.

The endpoint waits up to five seconds for Meta and reports a generic 502 if
delivery fails. It logs no request data or vendor error bodies. There is no
durable retry queue; lost network requests can still lose pageviews. There are
no claims of complete attribution or confirmed store footfall.

References:

- https://developers.facebook.com/docs/marketing-api/conversions-api/
- https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/
- https://developers.facebook.com/docs/meta-pixel/implementation/gdpr/
