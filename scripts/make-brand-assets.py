#!/usr/bin/env python3
"""Generate all footfall brand assets into public/brand/.

The mark: a pin-blue (#2b4eff) rounded square (corner radius ~22% of side)
with a white concentric double-ring "◎" centred on it — outer ring stroke
~7% of side, ring outer diameter ~56% of side, inner filled dot ~18% of side.

Everything is drawn procedurally at 4x supersample, then downscaled with
LANCZOS for clean antialiasing. Safe to re-run any time (idempotent: it
simply overwrites the outputs).

Usage: python3 scripts/make-brand-assets.py
"""

import os

from PIL import Image, ImageDraw

PIN_BLUE = (43, 78, 255, 255)  # #2b4eff
PAPER = (250, 249, 247, 255)  # #faf9f7
WHITE = (255, 255, 255, 255)

SS = 4  # supersample factor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "brand")


def draw_mark(draw: ImageDraw.ImageDraw, x: float, y: float, side: float) -> None:
    """Draw the full logo mark (rounded square + rings) with its top-left
    corner at (x, y) and the given side length, in supersampled coords."""
    radius = 0.22 * side
    draw.rounded_rectangle(
        [x, y, x + side - 1, y + side - 1], radius=radius, fill=PIN_BLUE
    )

    cx = x + side / 2
    cy = y + side / 2

    def circle(diameter: float, fill) -> None:
        r = diameter / 2
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

    ring_outer = 0.56 * side  # outer diameter of the ring
    stroke = 0.07 * side  # ring stroke width
    circle(ring_outer, WHITE)  # ring, outer edge
    circle(ring_outer - 2 * stroke, PIN_BLUE)  # punch the ring hole
    circle(0.18 * side, WHITE)  # inner filled dot


def make_logo(size: int) -> Image.Image:
    """The mark alone on a transparent square canvas of the given size."""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw_mark(ImageDraw.Draw(img), 0, 0, big)
    return img.resize((size, size), Image.LANCZOS)


def make_maskable(size: int) -> Image.Image:
    """Full-bleed #2b4eff background; the rounded square fills only the
    inner 80% safe zone (for PWA maskable icons)."""
    big = size * SS
    img = Image.new("RGBA", (big, big), PIN_BLUE)
    side = 0.8 * big
    off = (big - side) / 2
    draw_mark(ImageDraw.Draw(img), off, off, side)
    return img.resize((size, size), Image.LANCZOS)


def make_og(width: int = 1200, height: int = 630, mark: int = 220) -> Image.Image:
    """Paper background with the logo mark centred-left. No text."""
    big_w, big_h = width * SS, height * SS
    img = Image.new("RGBA", (big_w, big_h), PAPER)
    side = mark * SS
    x = 120 * SS  # left margin — mark sits centred-left
    y = (big_h - side) / 2
    draw_mark(ImageDraw.Draw(img), x, y, side)
    return img.resize((width, height), Image.LANCZOS).convert("RGB")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    for size in (1024, 512, 192, 180, 64, 32, 16):
        path = os.path.join(OUT_DIR, f"logo-{size}.png")
        make_logo(size).save(path)
        print(f"wrote {path}")

    ico_path = os.path.join(OUT_DIR, "favicon.ico")
    make_logo(48).save(ico_path, sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"wrote {ico_path}")

    maskable_path = os.path.join(OUT_DIR, "logo-maskable-512.png")
    make_maskable(512).save(maskable_path)
    print(f"wrote {maskable_path}")

    og_path = os.path.join(OUT_DIR, "og-image.png")
    make_og().save(og_path)
    print(f"wrote {og_path}")


if __name__ == "__main__":
    main()
