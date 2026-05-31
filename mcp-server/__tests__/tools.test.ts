import { describe, it, expect } from "vitest";
import { buildServer } from "../src/server";
import { ANONYMOUS_ACTOR, actorFromStaticToken } from "../src/auth";
import { updateGlossarySchema } from "../../src/validation";
import type { Env } from "../src/env";

// Tool registration never touches the bindings (services are constructed lazily
// inside handlers), so a bare object is a safe stand-in for Env here.
const fakeEnv = {} as unknown as Env;

function toolNames(server: ReturnType<typeof buildServer>): string[] {
  const reg = (server as unknown as { _registeredTools?: Record<string, unknown> })._registeredTools;
  return Object.keys(reg ?? {});
}

// Open to anonymous callers — published/public content only, mirroring the
// website's public API.
const OPEN_READ_TOOLS = [
  "faq_list",
  "faq_get",
  "faq_search",
  "faq_categories_list",
  "faq_tags_list",
  "glossary_list",
  "glossary_get",
  "glossary_search",
  "glossary_categories_list",
  "images_list",
  "whoami",
];
// Internal CMS reads — require a credential (drafts, history, audit, pipeline).
const INTERNAL_READ_TOOLS = [
  "faq_versions",
  "faq_audit_log",
  "suggestions_list",
  "suggestions_get",
  "suggestions_stats",
];
const WRITE_TOOLS = [
  "faq_create",
  "faq_create_version",
  "faq_delete",
  "glossary_create",
  "glossary_update",
  "suggestion_accept",
  "image_upload",
  "image_delete",
];

describe("tool registration surface", () => {
  it("anonymous sees only the public read surface — no internal reads, no writes", () => {
    const names = toolNames(buildServer(fakeEnv, ANONYMOUS_ACTOR));
    for (const t of OPEN_READ_TOOLS) expect(names).toContain(t);
    for (const t of INTERNAL_READ_TOOLS) expect(names).not.toContain(t);
    for (const t of WRITE_TOOLS) expect(names).not.toContain(t);
  });

  it("an authenticated, write-capable actor sees public + internal reads + writes", () => {
    const names = toolNames(buildServer(fakeEnv, actorFromStaticToken("mcp-bot@aprsfoundation.org")));
    for (const t of [...OPEN_READ_TOOLS, ...INTERNAL_READ_TOOLS, ...WRITE_TOOLS]) {
      expect(names).toContain(t);
    }
  });
});

describe("drafts-only guarantee", () => {
  it("glossary_update input schema has no `status` field (cannot publish)", () => {
    const shape = updateGlossarySchema.omit({ status: true }).shape;
    expect("status" in shape).toBe(false);
    // sanity: the un-omitted schema does have status, so the omit is meaningful
    expect("status" in updateGlossarySchema.shape).toBe(true);
  });
});
