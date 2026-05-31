/**
 * Type augmentation for `@cloudflare/vitest-pool-workers`.
 *
 * Tests import `env` from the virtual `cloudflare:test` module. Its
 * `ProvidedEnv` interface is empty by default, so references like `env.DB`
 * fail `tsc --noEmit` even though the pool provides the real bindings at
 * runtime (from wrangler.toml). Extend ProvidedEnv with the worker's `Env`
 * so the test files type-check against the same bindings the worker uses.
 */
import type { Env } from "../src/env";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
