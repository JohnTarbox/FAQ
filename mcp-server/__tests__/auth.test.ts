import { describe, it, expect } from "vitest";
import { classifyRequest, resolveRole, hasMinRole, actorFromProps } from "../src/auth";

const TOKEN = "secret-write-token";

describe("classifyRequest", () => {
  it("routes GET / to info and /version to version", () => {
    expect(classifyRequest("GET", "/", null, TOKEN, false)).toBe("info");
    expect(classifyRequest("GET", "/version", null, TOKEN, false)).toBe("version");
  });

  it("defaults a missing token to oauth (so the provider issues the 401 challenge)", () => {
    // No ?anon=1 → must NOT be anonymous; claude.ai needs the 401 to start OAuth.
    expect(classifyRequest("POST", "/mcp", null, TOKEN, false)).toBe("oauth");
    expect(classifyRequest("POST", "/sse", null, TOKEN, false)).toBe("oauth");
  });

  it("routes explicit anonymous opt-in (?anon=1, no auth) to open-read", () => {
    expect(classifyRequest("POST", "/mcp", null, TOKEN, true)).toBe("open-read");
    expect(classifyRequest("POST", "/sse", null, TOKEN, true)).toBe("open-read");
  });

  it("routes the exact static write token to static-write (regardless of anon)", () => {
    expect(classifyRequest("POST", "/mcp", `Bearer ${TOKEN}`, TOKEN, false)).toBe("static-write");
    expect(classifyRequest("POST", "/mcp", `Bearer ${TOKEN}`, TOKEN, true)).toBe("static-write");
  });

  it("falls through any non-matching Bearer to oauth (never hard-rejects)", () => {
    // An OAuth-issued token is sent as Bearer too — it must reach the provider.
    expect(classifyRequest("POST", "/mcp", "Bearer some-oauth-access-token", TOKEN, false)).toBe("oauth");
    expect(classifyRequest("POST", "/mcp", "Bearer wrong", TOKEN, true)).toBe("oauth");
  });

  it("routes OAuth dance paths to oauth", () => {
    expect(classifyRequest("GET", "/authorize", null, TOKEN, false)).toBe("oauth");
    expect(classifyRequest("POST", "/token", null, TOKEN, false)).toBe("oauth");
    expect(classifyRequest("POST", "/register", null, TOKEN, false)).toBe("oauth");
    expect(classifyRequest("GET", "/callback", null, TOKEN, false)).toBe("oauth");
  });

  it("does not treat the static token on non-mcp paths as static-write", () => {
    expect(classifyRequest("POST", "/authorize", `Bearer ${TOKEN}`, TOKEN, false)).toBe("oauth");
  });

  it("treats a missing write-token config as never-static", () => {
    expect(classifyRequest("POST", "/mcp", `Bearer ${TOKEN}`, undefined, false)).toBe("oauth");
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
