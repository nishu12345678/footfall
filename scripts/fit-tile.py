#!/usr/bin/env python3
"""Centre-crop a photo to the landing-page trade tile's aspect and write a
tuned JPEG.

    python3 scripts/fit-tile.py <in.jpg> <out.jpg>

Sized for the largest the tile is ever painted (240px wide at desktop) on
a 2x screen, with a little headroom: 720x624 keeps the 240x208 ratio at 3x
without shipping a 2MB original for a thumbnail.

A source smaller than that is cropped at its OWN resolution rather than
upscaled: enlarging invents detail and softens the result, and the tile
is only 240px wide, so even a ~450px crop is comfortably past 1x.
"""
import sys
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
W, H = 720, 624
RATIO = W / H

im = Image.open(SRC).convert("RGB")

if im.width >= W and im.height >= H:
    target_w, target_h = W, H
    scale = max(W / im.width, H / im.height)
    im = im.resize(
        (max(1, round(im.width * scale)), max(1, round(im.height * scale))),
        Image.LANCZOS,
    )
else:
    # Largest centre crop the source can give at the tile's ratio.
    if im.width / im.height > RATIO:
        target_h = im.height
        target_w = round(im.height * RATIO)
    else:
        target_w = im.width
        target_h = round(im.width / RATIO)

left = (im.width - target_w) // 2
top = (im.height - target_h) // 2
im = im.crop((left, top, left + target_w, top + target_h))
im.save(DST, "JPEG", quality=82, optimize=True, progressive=True)
print(f"  {DST} ({im.width}x{im.height})")
