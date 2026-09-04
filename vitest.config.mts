import { defineConfig } from "vitest/config";

/**
 * Convex functions run in a V8 isolate, not Node, so the tests run in the
 * edge runtime to match. Only convex/ is tested this way; the Next app has
 * no unit tests yet.
 */
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
