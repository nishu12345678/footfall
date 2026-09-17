import { defineConfig } from "vitest/config";

/**
 * Convex functions run in a V8 isolate, not Node, so the tests run in the
 * edge runtime to match.
 *
 * lib/ is included for pure logic worth pinning down — currently the
 * launch-offer deadline, whose failures are all invisible until a date
 * passes, and are therefore exactly the kind nobody catches by looking
 * at the page.
 */
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
