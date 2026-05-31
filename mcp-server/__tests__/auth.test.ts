import { describe, it, expect } from "vitest";
import { classifyRequest, resolveRole, hasMinRole, actorFromProps } from "../src/auth";

const TOKEN = "secret-write-token";

describe("classifyRequest", () => {
  it("routes GET / to info and /version to version", () => {
    expect(classifyRequest("GET", "/", null, TOKEN)).toBe("info");
    expect(classifyRequest("GET", "/version", null, TOKEN)).toBe("version");
  });

  it("routes unauthenticated /mcp and /sse to open-read", () => {
    expect(classifyRequest("POST", "/mcp", null, TOKEN)).toBe("open-read");
    expect(classifyRequest("POST", "/sse", null, TOKEN)).toBe("open-read");
  });

  it("routes the exact static write token to static-write", () => {
    expect(classifyRequest("POST", "/mcp", `Bearer ${TOKEN}`, TOKEN)).toBe("static-write");
  });

  it("falls through any non-matching Bearer to oauth (never hard-rejects)", () => {
    // An OAuth-issued token is sent as Bearer too — it must reach the provider.
    expect(classifyRequest("POST", "/mcp", "Bearer some-oauth-access-token", TOKEN)).toBe("oauth");
    expect(classifyRequest("POST", "/mcp", "Bearer wrong", TOKEN)).toBe("oauth");
  });

  it("routes OAuth dance paths to oauth", () => {
    expect(classifyRequest("GET", "/authorize", null, TOKEN)).toBe("oauth");
    expect(classifyRequest("POST", "/token", null, TOKEN)).toBe("oauth");
    expect(classifyRequest("POST", "/register", null, TOKEN)).toBe("oauth");
    expect(classifyRequest("GET", "/callback", null, TOKEN)).toBe("oauth");
  });

  it("does not treat the static token on non-mcp paths as static-write", () => {
    expect(classifyRequest("POST", "/authorize", `Bearer ${TOKEN}`, TOKEN)).toBe("oauth");
  });

  it("treats a missing write-token config as never-static", () => {
    expect(classifyRequest("POST", "/mcp", `Bearer ${TOKEN}`, undefined)).toBe("oauth");
  });
});

describe("role mapping", () => {
  it("maps Okta groups to roles", () => {
    expect(resolveRole(["CMS-Admins"])).toBe("admin");
    expect(resolveRole(["CMS-Reviewers"])).toBe("reviewer");
    expect(resolveRole(["Everyone"])).toBe("author");
    expect(resolveRole([])).toBe("author");
  });

  it("respects the role hierarchy", () => {
    expect(hasMinRole("admin", "reviewer")).toBe(true);
    expect(hasMinRole("author", "reviewer")).toBe(false);
    expect(hasMinRole("author", "author")).toBe(true);
  });

  it("lets any authenticated user write drafts", () => {
    expect(actorFromProps({ email: "a@b.com", role: "author" }).canWrite).toBe(true);
  });
});
