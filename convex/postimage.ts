"use node";

import { v } from "convex/values";
import { Jimp, loadFont, measureText } from "jimp";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/*
 * Text on the picture.
 *
 * Of everything measured about Google Posts, this is the largest single
 * effect: across an analysis of more than a thousand posts, ones whose
 * image carried text drew 2.03 clicks against 0.59 for images without —
 * better than three times as many. Original photos beat stock by 5.6x, so
 * the shop's own photo with a line of text over it is the best of both,
 * and that is what this makes. A logo measured no difference either way,
 * so we don't add one.
 *
 * The lettering is drawn here rather than asked of the image model. Image
 * models render text as convincing gibberish, and this goes out under a
 * real business's name.
 */

/*
 * Convex bundles JavaScript, not jimp's font assets, so the bitmap fonts
 * are pulled from the CDN copy of the package we already depend on. jimp
 * resolves the font's sibling .png atlas against the same URL.
 */
const FONT_BASE =
  "https://cdn.jsdelivr.net/npm/@jimp/plugin-print@1.6.1/dist/fonts/open-sans";
const FONT_HEADLINE = `${FONT_BASE}/open-sans-64-white/open-sans-64-white.fnt`;
const FONT_CAPTION = `${FONT_BASE}/open-sans-32-white/open-sans-32-white.fnt`;

const W = 1200;
const H = 900;
const PAD = 72;

/**
 * The bitmap font covers Latin-1 and nothing else, so a curly apostrophe
 * comes out as "?" — which is what "Here's" became on the first live post.
 * Straighten the punctuation before drawing.
 */
function plain(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^ -ÿ]/g, "");
}

/** Splits a headline into lines that fit the frame, by real measurement. */
function wrap(
  text: string,
  font: Awaited<ReturnType<typeof loadFont>>,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measureText(font, candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.slice(0, maxLines);
}

export const addHeadline = internalAction({
  args: {
    postId: v.id("posts"),
    imageUrl: v.string(),
    headline: v.string(),
    businessName: v.string(),
  },
  handler: async (
    ctx,
    { postId, imageUrl, headline, businessName },
  ): Promise<string | null> => {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        console.error(`[postimage] source ${res.status}`);
        return null;
      }

      const image = await Jimp.fromBuffer(await res.arrayBuffer());
      image.cover({ w: W, h: H });

      const [big, small] = await Promise.all([
        loadFont(FONT_HEADLINE),
        loadFont(FONT_CAPTION),
      ]);

      const lines = wrap(plain(headline).trim(), big, W - PAD * 2, 3);
      if (lines.length === 0) return null;

      const lead = 78;
      const blockH = lines.length * lead;
      // Text sits on the lower third: it covers least of the subject there
      // and still reads first on a phone.
      const top = H - 150 - blockH;

      // Darken behind the words so they stay legible over anything — a
      // white clinic wall as readily as a dark suit.
      //
      // Built from many thin translucent strips. Writing the pixels
      // directly would be the obvious way and does nothing: jimp hands back
      // a bitmap those writes never reach. Enough strips and the steps
      // between them stop being visible.
      const shadeTop = Math.max(0, top - 200);
      const strips = 48;
      const stripH = Math.ceil((H - shadeTop) / strips);
      for (let s = 0; s < strips; s++) {
        const y = shadeTop + s * stripH;
        const height = Math.min(stripH, H - y);
        if (height <= 0) break;
        const panel = new Jimp({ width: W, height, color: 0x000000ff });
        // Full strength by the time the ramp reaches the first line of
        // text, then held. Ramping all the way to the bottom edge instead
        // leaves the headline itself sitting on half-shade.
        const reach = Math.max(top - shadeTop, 1);
        const depth = Math.min((y + height / 2 - shadeTop) / reach, 1);
        image.composite(panel, 0, y, {
          opacitySource: Math.pow(depth, 1.25) * 0.74,
        });
      }

      lines.forEach((line, i) => {
        image.print({ font: big, x: PAD, y: top + i * lead, text: line });
      });

      // The name only goes on when the headline hasn't already said it.
      const name = plain(businessName).slice(0, 46);
      const headlineSaysName = lines
        .join(" ")
        .toLowerCase()
        .includes(name.toLowerCase().slice(0, 18));
      if (!headlineSaysName) {
        image.print({ font: small, x: PAD, y: H - 62, text: name });
      }

      // Google takes JPG between 10 KB and 5 MB; this lands far inside.
      const out = await image.getBuffer("image/jpeg", { quality: 86 });
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array(out)], { type: "image/jpeg" }),
      );

      return await ctx.runMutation(internal.posts.attachHeadlineImage, {
        postId,
        storageId,
      });
    } catch (error) {
      console.error("[postimage] overlay failed", error);
      return null;
    }
  },
});
