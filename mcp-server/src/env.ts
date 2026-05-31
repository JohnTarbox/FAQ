/**
 * Bindings for the FAQ/Glossary MCP Worker. Mirrors the main app's bindings
 * (DB/CACHE/IMAGES/AI) plus the OAuth + Durable Object plumbing the remote MCP
 * surface needs. See wrangler.toml.
 */
export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  IMAGES: R2Bucket;

  /** OAuth provider state/token storage + Okta JWKS cache. */
  OAUTH_KV: KVNamespace;
  /** Durable Object namespace backing the McpAgent (class FaqMcp). */
  MCP_OBJECT: DurableObjectNamespace;

  ENVIRONMENT?: string;
  OKTA_DOMAIN: string;
  OKTA_CLIENT_ID: string;
  OKTA_CLIENT_SECRET: string;

  /** Static bearer that gates writes from Claude Code (.mcp.json). */
  MCP_WRITE_TOKEN: string;
  /** Audit actor used for static-token writes (no human identity). */
  MCP_ACTOR_EMAIL?: string;

  /** Per-IP rate limiter for the anonymous public-read surface (optional). */
  READ_RATE_LIMITER?: import("./ratelimit").RateLimiter;
}

/**
 * OAuth props attached to an issued access token, surfaced as McpAgent.props.
 * The index signature satisfies the agents SDK's `Props extends Record<string,
 * unknown>` constraint.
 */
export interface UserProps {
  email: string;
  role: import("./auth").UserRole;
  groups: string[];
  [key: string]: unknown;
}
