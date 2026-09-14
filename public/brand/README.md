# footfall brand assets

This folder is the **single home** for app logo assets. Don't scatter logo files elsewhere.

The mark is the storefront pin: a blue map pin holding a green shopfront.

- `source.png` — 2048×2048 master artwork (the mark on its original flat background). Everything below is derived from it.
- `logo-1024.png` / `logo-512.png` / `logo-192.png` — large sizes and PWA icons, transparent background.
- `logo-64.png` — general UI (nav, footer); `logo-32.png` / `logo-16.png` — small favicons referenced from metadata.
- `logo-180.png` — apple touch icon (opaque paper background — iOS composites transparent icons onto black).
- `favicon.ico` — multi-size (16/32/48) classic favicon.
- `logo-maskable-512.png` — PWA maskable icon (mark inside the 80% safe zone on full-bleed paper).
- `og-image.png` — 1200×630 Open Graph card (paper background, mark centred-left).
- `v1/` — the previous generation of the mark (blue rounded square with a double ring), kept for reference. Nothing references it.

Regenerate everything with `python3 scripts/make-brand-assets.py`.
