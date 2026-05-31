/**
 * Per-IP rate limiting for the anonymous public-read MCP surface, using
 * Cloudflare's Workers Rate Limiting binding. Only the no-auth path is limited;
 * token/OAuth callers are trusted and pass through. Kept free of Workers-only
 * imports so it can be unit-tested under the node pool.
 */

/** Minimal shape of the Cloudflare rate-limit binding (env.READ_RATE_LIMITER). */
export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

/** Rate-limit key: the originating client IP (falls back when absent). */
export function clientKey(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

/**
 * Returns a 429 Response if the caller is over the limit, otherwise null (let
 * the request proceed). A missing binding (e.g. local dev) disables limiting.
 */
export async function enforceRateLimit(
  limiter: RateLimiter | undefined,
  request: Request
): Promise<Response | null> {
  if (!limiter) return null;
  const { success } = await limiter.limit({ key: clientKey(request) });
  if (success) return null;
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32029, message: "Rate limit exceeded — slow down and retry shortly." },
    }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
  );
}
