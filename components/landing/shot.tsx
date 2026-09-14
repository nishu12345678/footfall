import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { SHOTS, type ShotKey } from "@/lib/landing-images";

const EXTS = ["webp", "png", "jpg", "jpeg"] as const;

/**
 * Finds public/marketing/<key>.<ext>, if the artwork has been dropped in.
 * Server-only: this component reads the filesystem at render time so a
 * missing picture degrades to a placeholder instead of a broken image.
 */
function find(key: ShotKey): string | null {
  const dir = path.join(process.cwd(), "public", "marketing");
  for (const ext of EXTS) {
    if (existsSync(path.join(dir, `${key}.${ext}`))) {
      return `/marketing/${key}.${ext}`;
    }
  }
  return null;
}

export function Shot({
  name,
  priority = false,
  className = "",
  sizes = "(min-width: 1024px) 600px, 100vw",
  plain = false,
}: {
  name: ShotKey;
  priority?: boolean;
  className?: string;
  sizes?: string;
  /** No border or radius of its own — the parent draws the frame. */
  plain?: boolean;
}) {
  const shot = SHOTS[name];
  const src = find(name);

  if (src) {
    return (
      <Image
        src={src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        priority={priority}
        sizes={sizes}
        className={`h-auto w-full ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={shot.alt}
      style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
      className={`relative w-full overflow-hidden bg-[var(--l-wash)] ${
        plain ? "" : "rounded-2xl border border-dashed border-[#d1d5db]"
      } ${className}`}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 p-4 text-left">
        <p className="font-mono text-[12px] text-[var(--l-muted)]">
          public/marketing/{name}.webp · {shot.width}×{shot.height}
        </p>
      </div>
    </div>
  );
}
