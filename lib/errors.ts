import { ConvexError } from "convex/values";

/**
 * One place that turns whatever was thrown into a sentence a shop owner
 * can read.
 *
 * Backend functions throw `ConvexError("plain sentence")` for anything the
 * owner is meant to see; that string survives to the browser in production.
 * A plain `Error` from the server arrives as "[Request ID: …] Server Error"
 * (with the stack appended in dev), and must never reach the screen as-is.
 */
export const GENERIC = "Something went wrong. Please try again.";

const NOISE = [
  /^\[Request ID: [^\]]+\]\s*/i,
  /^Server Error\s*/i,
  /^Uncaught (?:Convex)?Error:\s*/i,
  /^Error:\s*/i,
];

export function friendlyError(e: unknown, fallback = GENERIC): string {
  if (e instanceof ConvexError) {
    const d = e.data;
    if (typeof d === "string" && d.trim()) return d.trim();
    if (d && typeof d === "object" && "message" in d) {
      const m = (d as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
    return fallback;
  }

  const raw =
    e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!raw) return fallback;

  // In dev the server error carries the thrown message on its own line
  // after "Uncaught Error:". Take that line and nothing else.
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  let text = "";
  for (const line of lines) {
    let t = line;
    for (const re of NOISE) t = t.replace(re, "");
    if (/^at\s/.test(t) || /^Called by/i.test(t)) continue;
    if (t) {
      text = t;
      break;
    }
  }
  // Only the shape of a sentence gets through; anything that still looks
  // like a stack, an id or an HTTP dump is replaced with the fallback.
  if (!text || text.length > 240 || /\bat\s+\w+\s*\(/.test(text)) return fallback;
  if (/^(Server Error|Error)$/i.test(text)) return fallback;
  if (/^\{|^\[|Request ID|Uncaught|TypeError|ReferenceError|SyntaxError/i.test(text)) {
    return fallback;
  }
  return text;
}
