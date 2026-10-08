import { isIP } from "node:net";
import {
  isMetaPage,
  META_CONSENT_COOKIE,
  metaBrowserId,
  metaPixelId,
  parseMetaPageView,
  readCookie,
} from "./meta";

const MAX_BODY_BYTES = 2048;

async function readSmallJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

function reply(status: number) {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** A PageView-only relay, not a general-purpose client-controlled Meta proxy. */
export async function handleMetaPageView(request: Request) {
  const pixel = metaPixelId();
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  if (!pixel || !token || !version || !/^v\d+\.0$/.test(version))
    return reply(503);

  const url = new URL(request.url);
  if (url.protocol !== "https:" || !isMetaPage(url.hostname, "/") || url.port)
    return reply(403);
  if (request.headers.get("origin") !== url.origin) return reply(403);
  if (
    request.headers.get("sec-fetch-site") &&
    request.headers.get("sec-fetch-site") !== "same-origin"
  )
    return reply(403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply(415);
  const cookies = request.headers.get("cookie") ?? "";
  if (readCookie(cookies, META_CONSENT_COOKIE) !== "granted") return reply(403);

  let input: unknown;
  try {
    input = await readSmallJson(request);
  } catch {
    return reply(400);
  }
  const event = parseMetaPageView(input);
  if (!event) return reply(400);
  const agent = request.headers.get("user-agent");
  if (!agent || agent.length > 1024) return reply(400);

  // Vercel supplies this header. Never accept a client IP in JSON, and don't
  // trust arbitrary forwarding headers when running outside Vercel.
  const ip =
    process.env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim()
      : undefined;
  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  const payload = {
    data: [
      {
        event_name: "PageView",
        event_id: event.eventId,
        event_time: event.eventTime,
        action_source: "website",
        event_source_url: `${url.origin}${event.pathname}`,
        user_data: {
          client_user_agent: agent,
          ...(ip && isIP(ip) ? { client_ip_address: ip } : {}),
          fbp: metaBrowserId(readCookie(cookies, "_fbp"), "fbp"),
          fbc: metaBrowserId(readCookie(cookies, "_fbc"), "fbc"),
        },
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${pixel}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    const result = await response.json();
    if (!response.ok || result.events_received !== 1) {
      // No tokens, URLs, cookies, IPs or raw vendor errors in logs/responses.
      console.warn("Meta PageView rejected", { status: response.status });
      return reply(502);
    }
    return reply(204);
  } catch {
    console.warn("Meta PageView delivery unavailable");
    return reply(502);
  }
}
