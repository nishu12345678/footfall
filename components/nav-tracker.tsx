"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { noteNavigation } from "@/lib/nav-depth";

/** Counts route changes so the Back button knows when history is in-app. */
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    noteNavigation();
  }, [pathname]);
  return null;
}
