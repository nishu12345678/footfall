#!/usr/bin/env python3
"""
Check the statistics on the landing page against their sources.

    python3 scripts/verify-stats.py

Why this exists
---------------
The four numbers in WHY (lib/content.ts) sit on a page whose whole job is to
be trusted. A wrong one is expensive. They had no links and none of them
could be traced by hand, so this makes the check repeatable instead of a
thing somebody remembers to do.

Why it drives a browser
-----------------------
Neither source can be read with curl:

  · BrightLocal sits behind a Cloudflare interstitial. curl gets "Just a
    moment..."; headless Chrome with a normal User-Agent and enough time to
    solve the challenge gets the real page.
  · thinkwithgoogle.com is a single-page app whose server answers 200 for
    *any* path and returns the same shell. A 200 there is not evidence the
    page exists — two different URLs came back byte-identical. Only rendered
    text can tell you anything.

So: render, strip scripts and styles, search the text for the claim.

Exit code is non-zero if any checked claim is missing from its source, so
this can gate a deploy.
"""

from __future__ import annotations

import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "lib" / "content.ts"

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


def render(url: str, budget_ms: int = 30000) -> str:
    """Rendered text of a page, or '' if it could not be fetched."""
    with tempfile.TemporaryDirectory() as profile:
        try:
            out = subprocess.run(
                [
                    "google-chrome", "--headless", "--disable-gpu", "--no-sandbox",
                    "--disable-dev-shm-usage", "--disable-breakpad",
                    f"--user-data-dir={profile}",
                    f"--virtual-time-budget={budget_ms}",
                    f"--user-agent={UA}",
                    "--dump-dom", url,
                ],
                capture_output=True, text=True, timeout=budget_ms / 1000 + 60,
            ).stdout
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return ""

    if "Just a moment" in out and len(out) < 60_000:
        return ""  # never got past the challenge

    out = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", out, flags=re.S | re.I)
    out = re.sub(r"<[^>]+>", " ", out)
    return re.sub(r"\s+", " ", html.unescape(out))


def stats_from_content() -> list[dict]:
    """Pull the WHY.stats entries straight out of content.ts."""
    src = CONTENT.read_text(encoding="utf-8")
    block = src.split("export const WHY = {", 1)[1].split("\n};", 1)[0]
    found = []
    for m in re.finditer(
        r'value:\s*"([^"]+)",\s*\n\s*label:\s*"([^"]+)",\s*\n\s*source:\s*"([^"]+)",'
        r'(?:\s*\n\s*href:\s*"([^"]+)",)?',
        block,
    ):
        found.append(
            {"value": m.group(1), "label": m.group(2),
             "source": m.group(3), "href": m.group(4)}
        )
    return found


def main() -> int:
    stats = stats_from_content()
    if not stats:
        print("could not parse WHY.stats out of lib/content.ts")
        return 2

    print(f"Checking {len(stats)} statistics from {CONTENT.relative_to(ROOT)}\n")
    unverified = 0
    cache: dict[str, str] = {}

    for s in stats:
        head = f"{s['value']:>5}  {s['label'][:62]}"
        if not s["href"]:
            print(f"?  {head}\n       no source link — cannot be checked\n")
            unverified += 1
            continue

        if s["href"] not in cache:
            cache[s["href"]] = render(s["href"])
        text = cache[s["href"]]

        if not text:
            print(f"?  {head}\n       {s['href']}\n       page could not be rendered\n")
            unverified += 1
            continue

        if s["value"] in text:
            # Found the number — show its sentence so the WORDING can be
            # eyeballed too. A number can be right while the claim built on
            # it is not: "98% at least occasionally read reviews" is not the
            # same promise as "98% read reviews before choosing".
            i = text.index(s["value"])
            print(f"OK {head}\n       …{text[max(0, i - 110):i + 130].strip()}…\n")
        else:
            print(f"!! {head}\n       {s['value']} does NOT appear at {s['href']}\n")
            unverified += 1

    print("-" * 68)
    if unverified:
        print(f"{unverified} of {len(stats)} could not be verified.")
        print("Fix the wording, update the number, or drop the stat.")
        return 1
    print("All statistics found at their sources. Check the wording above too.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
