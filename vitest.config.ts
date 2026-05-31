import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    // Scope to the main app's tests. Without this, the default glob also picks
    // up mcp-server/__tests__/** (a separate workspace with its own vitest
    // config) and tries to run them under the Workers pool, which fails.
    include: ['tests/**/*.test.ts'],
    poolOptions: {
      workers: {
        isolatedStorage: false,
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: ['DB'],
          kvNamespaces: ['CACHE'],
          r2Buckets: ['IMAGES'],
          bindings: { ENVIRONMENT: 'development' },
        },
      },
    },
  },
});
