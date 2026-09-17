# Evidence for the numbers in the "Why your Google listing matters" section

Retrieved **2026-09-16**. Re-check with `python3 scripts/verify-stats.py`.

As of the rewrite on 2026-09-16 the page carries **four figures, all from
the same source, all linked, all passing `verify-stats.py`**:

| Figure | Claim |
| --- | --- |
| 97% | read reviews for local businesses |
| 47% | won’t use a business with fewer than 20 reviews |
| 74% | only care about reviews from the last three months |
| 41% | now “always” read reviews when browsing (up from 29%) |

The four figures that used to be here (76% / 28% / 87% / 98%) were
removed, not reworded — see "Removed" below for why each one failed.

Everything below is a **verbatim quote** pulled from the rendered page at
that URL on that date — not a summary, not a recollection. Where a claim
could not be evidenced, it says so plainly rather than guessing.

Both BrightLocal pages sit behind a Cloudflare interstitial: `curl` returns
"Just a moment…". These were read with headless Chrome using a normal
User-Agent and a long virtual-time budget, which is what
`scripts/verify-stats.py` does.

---

## ✅ Evidenced

### "98%" exists — but not for the claim we make

Source: <https://www.brightlocal.com/resources/online-reviews-statistics/>

> Why Businesses Need Online Reviews **98% of people at least ‘occasionally’
> read online reviews for local businesses** (Source: BrightLocal, Local
> Consumer Review Survey)

The page currently says *"98% read online reviews **before choosing** a
local business"*. The source says *at least occasionally read*. Occasional
reading is not reading before choosing — the digit is defensible, the
sentence built on it is not.

### The current survey says 97%, not 98%

Source: <https://www.brightlocal.com/research/local-consumer-review-survey/>
— *Local Consumer Review Survey 2026*

> **97% of consumers read reviews for local businesses**

> Even in a world where people are more aware and more frustrated by the
> scourge of fake reviews, **97% of consumers still lean on reviews** to
> guide their purchase decisions.

### Google's share is falling, not rising

Same source. This is a section heading on the page:

> **Google is Losing Traction**, but AI and Video Reviews are Picking Up Speed

> Google has always been the standout source for reviews, but this year its
> share has **dipped from 83% in 2025 to 71%**.

> recent BrightLocal research found that **just 35% of SMBs have a Google
> Business Profile**

This is the one that should worry us most. The page cites a stale
rising-Google figure while the source now reports the opposite direction.

### The panel is American

Same source, Methodology:

> The Local Consumer Review Survey 2026 was conducted using a
> **representative panel of 1,002 US adult consumers** via SurveyMonkey.

> Publications and individuals are welcome to use our research findings,
> graphics, and data, citing BrightLocal as the [source]

So quoting it is explicitly permitted — but it is US consumer behaviour, and
this page sells to a shop owner in Thane.

### Other current, quotable figures from the same survey

> **41% of consumers “always” read reviews** when browsing for businesses, a
> huge jump from last year (29%)

> **47% of consumers won’t use a business that has fewer than 20 reviews**

> **74% only care about reviews written in the last three months**

> **31% of consumers will only use a business that has 4.5+ stars**

---

## ❌ Removed from the page (not evidenced)

### "87% of consumers used Google to check out a local business in the last year"

Searched both BrightLocal pages above. **Not present on either.** The only
87% on either page is a different claim entirely:

> **87% of people have or are willing to write a review** of a business –
> only 13% say they never would. (Source: Sitejabber…)

This looks like a figure from an older edition of the survey. Given the
2026 edition reports Google's share *falling*, it should not be reinstated
without a citation to the specific edition it came from.

### "76% … visit a business within a day" and "28% … end in a purchase"

**No evidence found at all.**

These trace to a Google/Ipsos study from 2016 — a decade old. They cannot be
checked against thinkwithgoogle.com, because that site answers `200` for
*any* path and returns the same shell: two different URLs came back
byte-identical, so a `200` there proves nothing about whether a page exists.

The Wayback Machine is the right tool for a page this old, and it could not
be used on 2026-09-16 — the Internet Archive was first returning
"temporarily offline", then `429 Too Many Requests` on every attempt.

**This is the one piece that still needs a human, or a retry when the
Archive is healthy.** To finish it:

1. Find the original study — it is usually cited as *Google/Ipsos, “Consumers
   in the Micro-Moment”* (2016) or *Google/Purchased Digital Diary* (2016).
2. Search the Wayback Machine for a `thinkwithgoogle.com` snapshot carrying
   the figure:
   `http://web.archive.org/cdx/search/cdx?url=thinkwithgoogle.com*&output=json&limit=50`
3. If no primary source survives, the honest options are to attribute it
   precisely and unlinked — "Google/Ipsos, 2016" — so the reader can see how
   old it is, or to drop it.

A decade-old number about smartphone behaviour is a weak thing to put on a
page selling trust, even if the citation is found.
