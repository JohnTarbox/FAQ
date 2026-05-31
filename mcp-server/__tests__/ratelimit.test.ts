import { describe, it, expect } from "vitest";
import { enforceRateLimit, clientKey, type RateLimiter } from "../src/ratelimit";

const req = (ip?: string) =>
  new Request("https://mcp.faq.aprs.works/mcp", {
    method: "POST",
    headers: ip ? { "CF-Connecting-IP": ip } : {},
  });

const limiter = (success: boolean): RateLimiter => ({
  async limit() {
    return { success };
  },
});

describe("enforceRateLimit", () => {
  it("passes through (null) when no limiter is bound (e.g. local dev)", async () => {
    expect(await enforceRateLimit(undefined, req("1.2.3.4"))).toBeNull();
  });

  it("passes through (null) when under the limit", async () => {
    expect(await enforceRateLimit(limiter(true), req("1.2.3.4"))).toBeNull();
  });

  it("returns 429 with Retry-After when over the limit", async () => {
    const res = await enforceRateLimit(limiter(false), req("1.2.3.4"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBe("60");
  });

  it("keys by client IP, falling back to 'unknown'", () => {
    expect(clientKey(req("9.9.9.9"))).toBe("9.9.9.9");
    expect(clientKey(req())).toBe("unknown");
  });
});
