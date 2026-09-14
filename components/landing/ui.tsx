import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/*
 * Layout helpers shared by every landing section. Pure — no fs, no
 * hooks — so they are safe to import from client components too.
 */

/** One horizontal band of the page, 1200px wide, with the page gutter. */
export function Section({
  id,
  children,
  className = "",
  wash = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  wash?: boolean;
}) {
  return (
    <section
      id={id}
      className={`w-full scroll-mt-20 px-6 py-14 md:py-20 ${
        wash ? "bg-[var(--l-wash)]" : ""
      } ${className}`}
    >
      <div className="mx-auto w-full max-w-[1200px]">{children}</div>
    </section>
  );
}

/** Centered heading + one-line sub, the way every aidm section opens. */
export function Heading({
  title,
  sub,
  align = "center",
  size = "lg",
}: {
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
  size?: "lg" | "md";
}) {
  const centered = align === "center";
  return (
    <div className={`${centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}`}>
      <h2
        className={
          size === "lg"
            ? "text-4xl md:text-[3.25rem] md:leading-[1.08]"
            : "text-[2rem] md:text-[2.5rem] md:leading-[1.1]"
        }
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={`mt-4 text-lg text-[var(--l-muted)] md:text-xl ${
            centered ? "mx-auto max-w-2xl" : ""
          }`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** An icon in a tinted circle next to a title and a line. */
export function Bullet({
  icon,
  tone = "grey",
  title,
  children,
}: {
  icon: IconName;
  tone?: "grey" | "green" | "blue" | "rose" | "amber" | "violet";
  title: string;
  children: ReactNode;
}) {
  const tones = {
    grey: "bg-[var(--l-wash-2)] text-[var(--l-ink)]",
    green: "bg-[#e6f7ec] text-[#15803d]",
    blue: "bg-[#e8f0fe] text-[#1a56db]",
    rose: "bg-[#fde8ef] text-[#e11d48]",
    amber: "bg-[#fef3c7] text-[#b45309]",
    violet: "bg-[#f3e9fc] text-[#7c3aed]",
  } as const;

  return (
    <div className="flex items-start gap-4">
      <span className={`l-dot ${tones[tone]}`}>
        <Icon name={icon} />
      </span>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-[var(--l-muted)]">
          {children}
        </p>
      </div>
    </div>
  );
}

/** A ✓ line in a list of included things. */
export function Tick({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] leading-snug text-[var(--l-ink-2)]">
      <span className="mt-[3px] flex-none text-[var(--l-green)]">
        <Icon name="check" size={15} strokeWidth={2.5} />
      </span>
      {children}
    </li>
  );
}
