/**
 * Install the reviewed Pexels picks into public/trades/.
 *
 * Not part of the app build. Run by hand after reviewing the contact
 * sheets that scripts/pexels-all.mjs + scripts/tile-sheet.py produce:
 *   PEXELS_KEY=... node scripts/apply-trades.mjs
 *
 * Downloads the LARGE original for each pick (not the 940px preview used
 * for review), centre-crops to the tile's aspect and writes a tuned JPEG,
 * keeping the existing filenames so no component changes.
 *
 * Pexels licence: free for commercial use, no attribution required.
 * https://www.pexels.com/license/
 */

import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const KEY = process.env.PEXELS_KEY;
if (!KEY) throw new Error("PEXELS_KEY missing");

/** trade file name -> { set, index } chosen from /tmp/cand/<set>-sheet.jpg.
    `tiles` is deliberately absent: Pexels has no Indian tile showroom and
    the existing image stays until we source one. */
const PICKS = {
  salon: ["salon", 6],
  clinic: ["clinic", 7],
  sari: ["sari", 19],
  fashion: ["fashion", 4],
  kirana: ["kirana", 19],
  gym: ["gym2", 4],
  restaurant: ["restaurant", 7],
  coaching: ["coaching", 17],
  repairs: ["repairs", 8],
  sweets: ["sweets2", 8],
  mobile: ["mobile", 21],
  jewellers: ["jewellers", 15],
  chemist: ["chemist", 9],
  tailor: ["tailor", 21],
};

async function download(src, attempt = 0) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(String(res.status));
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    return download(src, attempt + 1);
  }
}

/** Fetch the photo's full-size original rather than the review preview. */
async function originalSrc(id) {
  const res = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
    headers: { Authorization: KEY },
  });
  if (!res.ok) throw new Error(`photo ${id}: ${res.status}`);
  const data = await res.json();
  return data.src.large2x ?? data.src.large;
}

const credits = [];

for (const [name, [set, idx]] of Object.entries(PICKS)) {
  const manifest = JSON.parse(
    await readFile(`/tmp/cand/${set}.json`, "utf8"),
  );
  const photo = manifest[idx];
  if (!photo) throw new Error(`${set}[${idx}] missing`);

  const buf = await download(await originalSrc(photo.id));
  const tmp = `/tmp/apply-${name}.jpg`;
  await writeFile(tmp, buf);

  // Crop + resize + encode through Python/Pillow, which is already a
  // dependency of the review scripts.
  await new Promise((resolve, reject) => {
    const p = spawn(
      "python3",
      ["scripts/fit-tile.py", tmp, `public/trades/${name}.jpg`],
      { stdio: "inherit" },
    );
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`fit ${name}`))));
  });

  credits.push({
    file: `public/trades/${name}.jpg`,
    photographer: photo.photographer,
    page: photo.page,
    alt: photo.alt,
  });
  console.log(`${name} <- ${set}[${idx}] (${photo.photographer})`);
}

await writeFile(
  "public/trades/CREDITS.json",
  JSON.stringify(credits, null, 2) + "\n",
);
console.log(`\n${credits.length} tiles written, credits recorded.`);
