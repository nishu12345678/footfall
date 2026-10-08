// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMetaPageView } from "./meta-server";

const event = () => ({
  eventId: "aba03e81-26d0-40ad-9189-12bd03e8d0ea",
  eventTime: Math.floor(Date.now() / 1000),
  pathname: "/",
});
const request = (
  body: unknown = event(),
  headers: Record<string, string> = {},
  host = "footfall.zone",
) =>
  new Request(`https://${host}/api/meta/events`, {
    method: "POST",
    headers: {
      origin: `https://${host}`,
      "content-type": "application/json",
      "user-agent": "Test browser",
      cookie:
        "footfall_meta_consent=granted; _fbp=fb.1.1791450000000.123456789; _fbc=fb.1.1791450000000.click-id",
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe("Meta CAPI relay", () => {
  const send = vi.fn();
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789012345");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "server-secret");
    vi.stubEnv("META_GRAPH_API_VERSION", "v25.0");
    vi.stubEnv("META_TEST_EVENT_CODE", "");
    vi.stubEnv("VERCEL", "1");
    vi.stubGlobal("fetch", send);
    send.mockReset().mockResolvedValue(Response.json({ events_received: 1 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a minimal matching PageView and keeps credentials out of the URL", async () => {
    const browserEvent = event();
    const response = await handleMetaPageView(
      request(
        {
          ...browserEvent,
          email: "private@example.com",
          event_name: "Purchase",
          value: 999,
        },
        { "x-vercel-forwarded-for": "203.0.113.8" },
      ),
    );
    expect(response.status).toBe(204);
    expect(send).toHaveBeenCalledTimes(1);
    const [url, options] = send.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v25.0/123456789012345/events");
    expect(options.headers.Authorization).toBe("Bearer server-secret");
    expect(JSON.parse(options.body)).toEqual({
      data: [
        {
          event_name: "PageView",
          event_id: browserEvent.eventId,
          event_time: browserEvent.eventTime,
          action_source: "website",
          event_source_url: "https://footfall.zone/",
          user_data: {
            client_user_agent: "Test browser",
            client_ip_address: "203.0.113.8",
            fbp: "fb.1.1791450000000.123456789",
            fbc: "fb.1.1791450000000.click-id",
          },
        },
      ],
    });
    expect(await response.text()).toBe("");
  });

  it("sends nothing when consent is absent, denied, or revoked", async () => {
    for (const cookie of [
      "",
      "footfall_meta_consent=denied",
      "other_footfall_meta_consent=granted",
    ]) {
      expect(
        (await handleMetaPageView(request(event(), { cookie }))).status,
      ).toBe(403);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects cross-site traffic, previews, shop hosts and private paths", async () => {
    expect(
      (
        await handleMetaPageView(
          request(event(), { origin: "https://evil.test" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleMetaPageView(
          request(event(), { "sec-fetch-site": "cross-site" }),
        )
      ).status,
    ).toBe(403);
    for (const host of [
      "salon.footfall.zone",
      "footfall.vercel.app",
      "localhost",
    ]) {
      expect(
        (await handleMetaPageView(request(event(), {}, host))).status,
      ).toBe(403);
    }
    expect(
      (
        await handleMetaPageView(
          request({ ...event(), pathname: "/app/report" }),
        )
      ).status,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails closed when credentials or version are not configured", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    expect((await handleMetaPageView(request())).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it("bounds bodies even without a Content-Length header and rejects invalid input", async () => {
    expect(
      (
        await handleMetaPageView(
          request({ ...event(), extra: "x".repeat(3000) }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await handleMetaPageView(request({ ...event(), eventId: "bad-id" })))
        .status,
    ).toBe(400);
    expect(
      (
        await handleMetaPageView(
          request(event(), { "content-type": "text/plain" }),
        )
      ).status,
    ).toBe(415);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not trust client forwarding headers on non-Vercel hosts", async () => {
    vi.stubEnv("VERCEL", "");
    await handleMetaPageView(
      request(event(), {
        "x-forwarded-for": "203.0.113.10",
        "x-vercel-forwarded-for": "203.0.113.11",
      }),
    );
    expect(
      JSON.parse(send.mock.calls[0][1].body).data[0].user_data
        .client_ip_address,
    ).toBeUndefined();
  });

  it("adds the temporary test code only when explicitly configured", async () => {
    vi.stubEnv("META_TEST_EVENT_CODE", "TEST123");
    await handleMetaPageView(request());
    expect(JSON.parse(send.mock.calls[0][1].body).test_event_code).toBe(
      "TEST123",
    );
  });

  it("returns a generic failure for rejection, timeout or zero accepted events", async () => {
    send.mockResolvedValueOnce(
      Response.json({ error: { message: "server-secret" } }, { status: 400 }),
    );
    send.mockRejectedValueOnce(new Error("timeout server-secret"));
    send.mockResolvedValueOnce(Response.json({ events_received: 0 }));
    for (let i = 0; i < 3; i++) {
      const response = await handleMetaPageView(request());
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain("server-secret");
    }
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      "server-secret",
    );
  });
});
