/**
 * Shared MCP server assembly. Used by all three surfaces:
 *   - the McpAgent Durable Object (claude.ai OAuth path) — calls
 *     registerAllTools(this.server, ...)
 *   - the stateless static-token handler (Claude Code)
 *   - the stateless open-read handler (no auth)
 * so the tool set + drafts-only guarantees live in exactly one place.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFaqTools } from "./tools/faq";
import { registerGlossaryTools } from "./tools/glossary";
import { registerSuggestionTools } from "./tools/suggestions";
import { registerImageTools } from "./tools/images";
import { jsonContent } from "./tools/common";
import type { Env } from "./env";
import type { Actor } from "./auth";

export const SERVER_INFO = { name: "APRS FAQ & Glossary", version: "1.0.0" };

/** Register every tool group plus the diagnostic `whoami`. */
export function registerAllTools(server: McpServer, env: Env, actor: Actor): void {
  // whoami reads the live tool registry at call time, so it reflects exactly
  // what this caller can see (read-only vs read+write).
  server.tool(
    "whoami",
    "Report your authentication status and which tools are available to you.",
    {},
    async () => {
      const registered = Object.keys(
        (server as unknown as { _registeredTools?: Record<string, unknown> })._registeredTools ?? {}
      );
      return jsonContent({
        authenticated: actor.isAuthenticated,
        email: actor.email,
        role: actor.role,
        canWrite: actor.canWrite,
        toolCount: registered.length,
        tools: registered.sort(),
      });
    }
  );

  registerFaqTools(server, env, actor);
  registerGlossaryTools(server, env, actor);
  registerSuggestionTools(server, env, actor);
  registerImageTools(server, env, actor);
}

/** Build a fresh stateless McpServer for the given actor. */
export function buildServer(env: Env, actor: Actor): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerAllTools(server, env, actor);
  return server;
}
