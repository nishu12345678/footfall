# footfall brand assets

This folder is the **single home** for app logo assets. Don't scatter logo files elsewhere.

- `logo.svg` — hand-written vector source of the mark (viewBox 0 0 1024 1024).
- `logo-1024.png` — raster master; `logo-512.png` / `logo-192.png` — PWA icons; `logo-64.png` general UI.
- `logo-180.png` — apple touch icon.
- `logo-32.png` / `logo-16.png` — small favicons referenced from metadata.
- `favicon.ico` — multi-size (16/32/48) classic favicon.
- `logo-maskable-512.png` — PWA maskable icon (mark inside the 80% safe zone on full-bleed #2b4eff).
- `og-image.png` — 1200×630 Open Graph card (paper background, mark centred-left).

Regenerate everything with `python3 scripts/make-brand-assets.py`.
