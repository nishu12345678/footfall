"use client";

import { Component, type ReactNode } from "react";
import { friendlyError } from "@/lib/errors";

/**
 * Catches a throwing Convex query on the dashboard.
 *
 * `useQuery` surfaces a failed query by throwing during render, so without
 * a boundary one refused or broken read replaces the whole route with
 * Next's error screen. That matters more here than elsewhere for a
 * specific reason: an `adminQuery` refuses with "Not found.", and the
 * allowlist can change under a session that is already open — an operator
 * whose email is removed while the tab is up should see a plain refusal,
 * not a crash.
 *
 * A class component because React still offers no hook for this.
 */
export class AdminErrorBoundary extends Component<
  { children: ReactNode; fallback?: (message: string) => ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return { message: friendlyError(error) };
  }

  componentDidCatch(error: unknown) {
    console.error("[admin]", error);
  }

  render() {
    const { message } = this.state;
    if (message === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback(message);

    return (
      <div
        role="alert"
        className="card p-5 text-[14px] leading-relaxed text-ink-soft"
      >
        <p className="text-[15px] font-semibold text-ink">
          This section couldn&rsquo;t load
        </p>
        <p className="mt-1.5">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-ghost btn-sm mt-4"
        >
          Reload
        </button>
      </div>
    );
  }
}
