import type { ReactNode } from "react";

/**
 * "Google", set in Google's own six letter colours.
 *
 * One rule for the whole landing page, so the word doesn't look like a
 * different decision every time it appears:
 *
 *   in a heading  → coloured, always (h1 and every section h2)
 *   in body copy  → left alone, in the same ink as the sentence around it
 *
 * Colouring it mid-paragraph turns a sentence into a logo parade and makes
 * the line harder to read; the hero deck used to do that. Headings are where
 * it earns its keep, because that is where the reader is scanning for what
 * this page is even about.
 *
 * <Heading> in ./ui.tsx applies this to its title automatically, so a new
 * section gets the treatment for free and cannot drift.
 */

/** Google's own letter colours: blue, red, yellow, blue, green, red. */
const GOOGLE_COLORS = [
  "#4285F4",
  "#EA4335",
  "#FBBC05",
  "#4285F4",
  "#34A853",
  "#EA4335",
];

/** The word itself, letter by letter. Never wraps mid-word. */
export function GoogleWord({ word = "Google" }: { word?: string }) {
  return (
    <span className="whitespace-nowrap">
      {word.split("").map((ch, i) => (
        <span key={i} style={{ color: GOOGLE_COLORS[i % GOOGLE_COLORS.length] }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/**
 * Colours every "Google" in a string and leaves the rest in ink. Safe to call
 * on any text: with no match it returns the string untouched.
 */
export function ColorGoogle({ text }: { text: string }): ReactNode {
  const parts = text.split("Google");
  if (parts.length === 1) return text;

  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 ? <GoogleWord /> : null}
    </span>
  ));
}
