/**
 * Fetch Pexels candidates for every trade tile on the landing page, into
 * /tmp/cand/<trade>/NN.jpg plus a <trade>.json manifest.
 *
 * Not part of the app build. Run by hand:
 *   PEXELS_KEY=... node scripts/pexels-all.mjs [trade ...]
 *
 * Several phrasings per trade on purpose: "kirana" and "grocery shop
 * India" surface completely different libraries, and the trades that are
 * thin on Pexels (tiles, coaching) need the widest net we can throw.
 *
 * Pexels licence: free for commercial use, no attribution required.
 * https://www.pexels.com/license/
 */

import { mkdir, writeFile } from "node:fs/promises";

const KEY = process.env.PEXELS_KEY;
if (!KEY) throw new Error("PEXELS_KEY missing");

const QUERIES = {
  salon: ["indian beauty parlour", "indian salon interior", "barber shop india"],
  clinic: ["indian doctor clinic", "dental clinic patient", "indian hospital reception"],
  sari: ["saree shop india", "indian clothing store display", "sari shop"],
  fashion: ["indian boutique clothing", "indian fashion store", "kurta shop india"],
  kirana: ["indian kirana store", "indian grocery shop", "indian provision store"],
  gym: ["indian gym workout", "gym india", "fitness centre india"],
  restaurant: ["indian restaurant interior", "indian dhaba", "indian cafe interior"],
  tiles: ["tile showroom", "ceramic tile store", "building material shop india"],
  coaching: ["indian classroom students", "indian coaching class", "india tuition teacher"],
  repairs: ["indian mechanic shop", "repair shop india", "indian workshop tools"],
  sweets: ["indian sweet shop", "mithai shop", "indian bakery counter"],
  mobile: ["mobile phone shop india", "indian electronics store", "phone repair shop"],
  jewellers: ["indian jewellery shop", "gold jewellery store india", "indian jeweller"],
  chemist: ["indian pharmacy", "medical store india", "pharmacist counter"],
  tailor: ["indian tailor sewing", "tailor shop india", "indian boutique tailor"],
};

const MAX = 24;

async function search(query, perPage = 12) {
  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&per_page=${perPage}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) throw new Error(`${query}: ${res.status}`);
  const data = await res.json();
  return (data.photos ?? []).map((p) => ({
    id: p.id,
    alt: p.alt,
    avgColor: p.avg_color,
    photographer: p.photographer,
    page: p.url,
    src: p.src.large, // 940px wide — plenty for a 240px tile at 2x
    query,
  }));
}

/** Retry with a backoff: Pexels resets the connection on a burst. */
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

/** Bounded fan-out; unbounded is what tripped ECONNRESET. */
async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await fn(items[idx], idx);
      } catch (err) {
        console.error("  skip:", err.message);
      }
    }
  });
  await Promise.all(workers);
}

const trades = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.keys(QUERIES);

for (const trade of trades) {
  const queries = QUERIES[trade];
  if (!queries) throw new Error(`unknown trade: ${trade}`);
  await mkdir(`/tmp/cand/${trade}`, { recursive: true });

  const seen = new Set();
  const picks = [];
  for (const q of queries) {
    for (const photo of await search(q)) {
      if (seen.has(photo.id) || picks.length >= MAX) continue;
      seen.add(photo.id);
      picks.push(photo);
    }
  }

  await pool(picks, 4, async (photo, idx) => {
    photo.file = `/tmp/cand/${trade}/${String(idx).padStart(2, "0")}.jpg`;
    await writeFile(photo.file, await download(photo.src));
  });

  await writeFile(`/tmp/cand/${trade}.json`, JSON.stringify(picks, null, 2));
  console.log(`${trade}: ${picks.length}`);
}
