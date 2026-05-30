import { defineConfig } from "vitest/config";

// Pure-function unit tests only (auth-route classification, tool-registration
// surface, drafts-only schema shape). These never touch D1, so a plain node
// environment is enough — the D1-backed behaviour (faq_create → draft row) is
// verified end-to-end against `wrangler dev` (see README). Keeping tests
// dependency-light avoids duplicating the main app's migration harness here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
