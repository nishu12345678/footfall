#!/usr/bin/env python3
"""Render one proposed 15-tile set exactly as the landing page shows it:
cover-cropped, under the real scrim, labelled with the trade name — so
the set is judged as a set, which is the thing the old one failed at.

Run by hand:
    python3 scripts/propose-set.py
Reads the PICKS table below from /tmp/cand/<trade>/NN.jpg.
Writes /tmp/proposed-set.jpg
"""
from PIL import Image, ImageDraw

# trade -> candidate index chosen from /tmp/cand/<trade>-sheet.jpg
PICKS = {
    "salon": 6,
    "clinic": 7,
    "sari": 19,
    "fashion": 4,
    "kirana": 19,
    "gym2": 4,
    "restaurant": 7,
    "tiles2": 16,
    "coaching": 17,
    "repairs": 8,
    "sweets2": 8,
    "mobile": 21,
    "jewellers": 15,
    "chemist": 9,
    "tailor": 21,
}

W, H = 260, 225
COLS = 5

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

rows = (len(PICKS) + COLS - 1) // COLS
sheet = Image.new("RGB", (W * COLS, H * rows), "white")

for i, (trade, idx) in enumerate(PICKS.items()):
    path = f"/tmp/cand/{trade}/{idx:02d}.jpg"
    im = Image.open(path).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))))
    left = (im.width - W) // 2
    top = (im.height - H) // 2
    im = im.crop((left, top, left + W, top + H))
    im = Image.composite(dark, im, scrim)
    ImageDraw.Draw(im).text((10, H - 24), trade, fill=(255, 255, 255))
    sheet.paste(im, ((i % COLS) * W, (i // COLS) * H))

sheet.save("/tmp/proposed-set.jpg", quality=88)
print("/tmp/proposed-set.jpg")
