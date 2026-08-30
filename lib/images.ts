/**
 * Google serves its photos at whatever width the URL suffix asks for.
 * We store them at 1600px because that is what Google wants back when we
 * publish, but a post card on a phone is 400px wide — sending 1.4MB for it
 * makes the screen look broken while it downloads.
 */
export function thumb(url: string | undefined, width = 600): string | undefined {
  if (!url) return undefined;
  if (!url.includes("googleusercontent.com")) return url;
  const base = url.replace(/=[sw]\d+(-[a-z0-9-]+)?$/i, "");
  return `${base}=w${width}`;
}
