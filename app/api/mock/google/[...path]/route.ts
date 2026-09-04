import { NextResponse, type NextRequest } from "next/server";
import { Jimp } from "jimp";
import { handleGoogleMock, hashSeed } from "@/lib/google-mock";

/**
 * The fake Google, served over HTTP for a local Convex backend.
 *
 * Off unless GOOGLE_MOCK_ENABLED=1 is set in .env.local, in which case every
 * path under /api/mock/google/ is answered by lib/google-mock.ts. Point the
 * backend at it with GOOGLE_API_MOCK_URL (see convex/googleHosts.ts and
 * docs/local-testing.md).
 *
 * Two locks, one on each side: the backend only looks here when its own
 * env var says so, and this route only answers when the Next env var says
 * so. Production sets neither, so a stray backend setting meets a 404.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enabled = () => process.env.GOOGLE_MOCK_ENABLED === "1";

async function parseBody(request: NextRequest): Promise<unknown> {
  if (["GET", "HEAD", "DELETE"].includes(request.method)) return null;
  const text = await request.text();
  if (!text) return null;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* -------------------------------- pictures -------------------------------
   Google hosts a listing's photos itself, and the app leans on that: it
   HEADs an image before attaching it to a post and expects a JPEG or PNG
   between 10 KB and 5 MB. So the mock draws its own, a gradient in a
   colour picked from the seed, at the 1200x900 Google recommends. The
   "=s0" / "=w1600" size suffix the app appends is ignored, as Google's
   CDN would honour it.                                                    */

const W = 1200;
const H = 900;
const pictures = new Map<string, ArrayBuffer>();

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

async function render(seed: string): Promise<ArrayBuffer> {
  const hue = hashSeed(seed) % 360;
  const image = new Jimp({ width: W, height: H, color: 0xffffffff });
  const data = image.bitmap.data;
  // A diagonal gradient with a soft disc off-centre: enough detail to land
  // comfortably over Google's 10 KB floor, and each seed looks different.
  const cx = W * (0.3 + ((hashSeed(`${seed}x`) % 40) / 100));
  const cy = H * (0.3 + ((hashSeed(`${seed}y`) % 40) / 100));
  const radius = Math.min(W, H) * 0.28;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = (x / W + y / H) / 2;
      const d = Math.hypot(x - cx, y - cy) / radius;
      const lift = d < 1 ? (1 - d) * 0.25 : 0;
      const [r, g, b] = hslToRgb(hue, 0.45, 0.32 + 0.3 * t + lift);
      const i = (y * W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const out = await image.getBuffer("image/jpeg", { quality: 82 });
  // A plain ArrayBuffer is what Response accepts without argument; a Node
  // Buffer's view over a shared buffer is not.
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(out);
  return copy;
}

async function picture(rest: string, method: string) {
  const seed = rest.replace(/=.*$/, "") || "blank";
  let body = pictures.get(seed);
  if (!body) {
    body = await render(seed);
    pictures.set(seed, body);
  }
  const headers = {
    "content-type": "image/jpeg",
    "content-length": String(body.byteLength),
    "cache-control": "no-store",
  };
  if (method === "HEAD") return new NextResponse(null, { headers });
  return new NextResponse(body, { headers });
}

/* --------------------------------- route -------------------------------- */

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!enabled()) return new NextResponse(null, { status: 404 });

  const { path } = await params;
  const joined = path.join("/");
  if (joined.startsWith("img/")) {
    return picture(joined.slice(4), request.method);
  }

  const bearer =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const result = handleGoogleMock({
    method: request.method,
    path: joined,
    query: request.nextUrl.searchParams,
    body: await parseBody(request),
    bearer,
    origin: `${request.nextUrl.origin}/api/mock/google`,
  });

  return NextResponse.json(result.body, { status: result.status });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
};
