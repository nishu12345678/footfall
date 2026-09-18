#!/usr/bin/env python3
"""Contact sheet of candidate photos, rendered as the landing page will
show them: cropped to the tile's aspect, under the same dark bottom-up
scrim, with the index burnt in so a pick can be named by number.

Run by hand:
    python3 scripts/tile-sheet.py <trade> [cols]
Reads /tmp/cand/<trade>/*.jpg, writes /tmp/cand/<trade>-sheet.jpg
"""
import sys, os, glob
from PIL import Image, ImageDraw

TRADE = sys.argv[1]
COLS = int(sys.argv[2]) if len(sys.argv) > 2 else 6

# The real tile is ~240x208 at desktop; keep that ratio.
W, H = 260, 225

files = sorted(glob.glob(f"/tmp/cand/{TRADE}/*.jpg"))
if not files:
    raise SystemExit(f"no candidates in /tmp/cand/{TRADE}")

rows = (len(files) + COLS - 1) // COLS
sheet = Image.new("RGB", (W * COLS, H * rows), "white")

# Same gradient as components/landing/trades.tsx: opaque at the foot,
# clearing towards the top.
scrim = Image.new("L", (1, H))
for y in range(H):
    t = y / (H - 1)
    if t < 0.54:
        a = int(0.12 * 255 + (0.55 - 0.12) * 255 * (t / 0.54))
    else:
        a = int(0.55 * 255 + (0.92 - 0.55) * 255 * ((t - 0.54) / 0.46))
    scrim.putpixel((0, y), a)
scrim = scrim.resize((W, H))
dark = Image.new("RGB", (W, H), (6, 10, 18))

for i, path in enumerate(files):
    im = Image.open(path).convert("RGB")
    # Cover-crop, as object-cover does.
    s = max(W / im.width, H / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))))
    left = (im.width - W) // 2
    top = (im.height - H) // 2
    im = im.crop((left, top, left + W, top + H))
    im = Image.composite(dark, im, scrim)

    d = ImageDraw.Draw(im)
    label = os.path.basename(path).split(".")[0]
    d.rectangle([0, 0, 34, 24], fill=(0, 0, 0))
    d.text((8, 6), label, fill=(255, 255, 255))
    sheet.paste(im, ((i % COLS) * W, (i // COLS) * H))

out = f"/tmp/cand/{TRADE}-sheet.jpg"
sheet.save(out, quality=86)
print(out, f"({len(files)} candidates)")
