"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * A textarea that grows with what's typed instead of growing a scrollbar.
 *
 * Modern browsers do this in CSS (`field-sizing: content`, set globally);
 * this measures scrollHeight for the ones that don't yet, so a four-line
 * address never sits in a three-line box with a scrollbar.
 */
export function AutoTextarea({
  minRows = 3,
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      style={{ minHeight: `${minRows * 1.5}em`, ...style }}
      {...props}
    />
  );
}
