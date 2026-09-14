#!/usr/bin/env python3
"""Generate all footfall brand assets into public/brand/.

The mark is the storefront-pin artwork in public/brand/source.png
(a blue map pin holding a green shopfront). This script cuts the mark
out of its flat background and derives every size the app references:

- logo-{1024,512,192,180,64,32,16}.png — transparent-background mark
  (180 is the apple-touch icon and gets an opaque paper background,
  because iOS composites transparent icons onto black)
- favicon.ico — classic 16/32/48 multi-size favicon
- logo-maskable-512.png — full-bleed paper background, mark inside the
  80% safe zone (PWA maskable)
- og-image.png — 1200×630 Open Graph card, paper background, mark
  centred-left (no text; the title comes from the page metadata)

Previous-generation assets live in public/brand/v1/.

Safe to re-run any time (idempotent: it simply overwrites the outputs).

Usage: python3 scripts/make-brand-assets.py
"""

import os

from PIL import Image, ImageDraw

PAPER = (250, 249, 247, 255)  # #faf9f7

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "brand")
SOURCE = os.path.join(OUT_DIR, "source.png")


def cut_mark() -> Image.Image:
    """The pin artwork alone: background made transparent, cropped to
    content, padded back out to a square canvas.

    The source has a flat near-white background (white page corners and
    an off-white rounded card, all connected). A flood fill from each
    corner removes exactly that; the whites inside the artwork survive
    because the navy outline seals them off.
    """
    img = Image.open(SOURCE).convert("RGBA")
    w, h = img.size

    sentinel = (255, 0, 255, 0)  # transparent magenta, never in the art
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(img, corner, sentinel, thresh=45)

    # JPEG noise leaves stray near-white specks the flood fill missed.
    # Anything still opaque but close to the background colour that has
    # a transparent neighbour is fringe — clear it, a few passes deep.
    px = img.load()
    for _ in range(3):
        fringe = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 or not (r > 225 and g > 225 and b > 220):
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        fringe.append((x, y))
                        break
        if not fringe:
            break
        for x, y in fringe:
            px[x, y] = sentinel

    bbox = img.getbbox()
    if bbox is None:
        raise SystemExit("source.png came out empty — check the flood fill")
    mark = img.crop(bbox)

    # Square canvas with 4% padding so nothing touches the edge.
    side = int(max(mark.size) * 1.08)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(
        mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark
    )
    return canvas


def on_paper(mark: Image.Image, size: int, scale: float = 0.86) -> Image.Image:
    """The mark centred on an opaque paper square (apple touch, maskable)."""
    img = Image.new("RGBA", (size, size), PAPER)
    inner = int(size * scale)
    m = mark.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    img.paste(m, (off, off), m)
    return img


def make_og(mark: Image.Image, width: int = 1200, height: int = 630) -> Image.Image:
    """Paper background with the mark centred-left. No text."""
    img = Image.new("RGBA", (width, height), PAPER)
    side = 340
    m = mark.resize((side, side), Image.LANCZOS)
    img.paste(m, (120, (height - side) // 2), m)
    return img.convert("RGB")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    mark = cut_mark()

    for size in (1024, 512, 192, 64, 32, 16):
        path = os.path.join(OUT_DIR, f"logo-{size}.png")
        mark.resize((size, size), Image.LANCZOS).save(path)
        print(f"wrote {path}")

    # Apple touch icon: opaque background, mark in the middle.
    apple_path = os.path.join(OUT_DIR, "logo-180.png")
    on_paper(mark, 180).save(apple_path)
    print(f"wrote {apple_path}")

    ico_path = os.path.join(OUT_DIR, "favicon.ico")
    mark.resize((48, 48), Image.LANCZOS).save(
        ico_path, sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print(f"wrote {ico_path}")

    maskable_path = os.path.join(OUT_DIR, "logo-maskable-512.png")
    on_paper(mark, 512, scale=0.72).save(maskable_path)
    print(f"wrote {maskable_path}")

    og_path = os.path.join(OUT_DIR, "og-image.png")
    make_og(mark).save(og_path)
    print(f"wrote {og_path}")


if __name__ == "__main__":
    main()
