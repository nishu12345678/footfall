# Landing variant harness — `design/landing-variants` only

A way to look at alternative treatments of a landing section **in the real
page**, at real width, with the real copy and the real neighbours around it —
instead of judging them in a mockup.

**Do not merge this folder to `main`.** When a treatment wins, copy it into the
real component, delete this folder, and revert the two hooks listed at the
bottom.

## Using it

Run the app and open `/`. Each wired section shows a pill in its top-right:

```
◀   Trades 5/8        ▶
    E · duotone photo
```

- **◀ / ▶** — step through that section's treatments.
- **← / →** — same thing, for whichever section the pointer is over.
- **Hide variant controls** (bottom-right) or **V** — hide every pill, so the
  page can be judged with no furniture in it.

Choices are kept in `localStorage`, so a reload brings back the same
combination — you can leave it on a candidate, walk away, and come back to it.

## What's wired

| Section | Treatments | File |
|---|---|---|
| Hero headline | 6 | `hero-variants.tsx` |
| Built for shops like yours | 8 | `trades-variants.tsx` |

Variant `0`/`A` in each is what is currently shipped, so there is always a
baseline to compare against.

### Hero

Six Hinglish headlines. The shipped line describes a *division of labour*
("you run the shop, we'll handle Google"); every candidate leads with the
*outcome* instead. Each carries its own tagline and sub so the three lines say
three different things — promise, who does the work, how. Each entry has a
`gloss` field with a plain-English translation for anyone reviewing without
Hindi.

Two constraints on any new headline:

1. it must contain `Google`, because `<Headline>` colours that word
   letter-by-letter in Google's palette;
2. it has to survive `md:text-6xl` without running to four lines — candidate 1
   already wraps to three.

### Trades

Eight treatments; B–E use photographs. The images in `public/variants/trades/`
are Creative-Commons filler from Openverse, downscaled to 640px. **They clash
on purpose** — sepia, black-and-white, a product shot of an iPhone 3GS for
"Mobile & electronics", two people posing for "Tiles", empty shelves for
"Kirana". Two sourcing rounds could not do better.

That is the finding: free stock cannot produce 15 consistent shop photos, so
picking B, C, D or E means budgeting for paid stock or a shoot. Judge the
*treatment*, not the pictures.

## How it works

`variant-shell.tsx` keeps the selection in `localStorage` and reads it through
`useSyncExternalStore`, so the first client paint matches the server's without
a `setState`-in-effect hydration dance (the React compiler lint rejects that
pattern).

Only the selected child is mounted, so the photo variants don't fetch their
images until you actually land on them.

Note that every child is still *rendered on the server* into the RSC payload,
even the ones not shown — fine for a review branch, another reason not to ship
it.

## Removing it

1. delete `components/landing/variants/` and `public/variants/`
2. in `app/page.tsx` — drop the `VariantProvider` wrapper and put `<Hero />`
   and `<Trades />` back
3. in `components/landing/hero.tsx` — the `headline` / `tagline` / `sub` props
   are harmless and default to `content.ts`, but can be reverted too
