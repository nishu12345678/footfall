/**
 * Google serves its photos at whatever the URL suffix asks for, so we ask
 * for the size we actually render rather than the original — one of the
 * clinic's photos was 1.8MB, and six of those on a screen reads as broken.
 *
 * "-c" centre-crops, which matches how Google itself frames post images.
 */
export function thumb(url: string | undefined, width = 600): string | undefined {
  if (!url) return undefined;
  if (!url.includes("googleusercontent.com")) return url;
  const base = url.replace(/=[a-z0-9-]+$/i, "");
  return `${base}=w${width}-h${Math.round((width * 3) / 4)}-c`;
}

/** Square, for grids. */
export function square(url: string | undefined, size = 400): string | undefined {
  if (!url) return undefined;
  if (!url.includes("googleusercontent.com")) return url;
  const base = url.replace(/=[a-z0-9-]+$/i, "");
  return `${base}=w${size}-h${size}-c`;
}
