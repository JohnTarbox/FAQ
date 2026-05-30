/**
 * AI suggestion queue tools. Accepting a suggestion creates a DRAFT FAQ via
 * SuggestionService.accept() → FaqService.create(), so the drafts-only rule
 * holds here too. No discovery-run / search-term / known-site management is
 * exposed — those stay admin-UI only.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SuggestionService } from "../../../src/services/suggestion.service";
import { CacheService } from "../../../src/services/cache.service";
import { jsonContent } from "./common";
import type { Env } from "../env";
import type { Actor } from "../auth";

export function registerSuggestionTools(server: McpServer, env: Env, actor: Actor): void {
  const svc = () => new SuggestionService(env.DB);
  const cache = () => new CacheService(env.CACHE);

  // The AI-suggestion queue is entirely internal CMS workflow data, so even the
  // reads require authentication (no public/anonymous surface here).
  if (!actor.isAuthenticated) return;

  // ---- Reads ----
  server.tool(
    "suggestions_list",
    "List AI-generated FAQ suggestions.",
    {
      status: z.enum(["new", "accepted", "dismissed"]).optional(),
      sourceType: z.enum(["web", "youtube", "site"]).optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(100).optional(),
    },
    async (args) => jsonContent(await svc().list(args))
  );

  server.tool(
    "suggestions_get",
    "Get a single AI suggestion by id.",
    { id: z.number().int().positive() },
    async (args) => jsonContent(await svc().getById(args.id))
  );

  server.tool("suggestions_stats", "Counts of suggestions by status.", {}, async () =>
    jsonContent(await svc().getStats())
  );

  if (!actor.canWrite) return;

  // ---- Writes ----
  server.tool(
    "suggestion_accept",
    "Accept an AI suggestion: creates a DRAFT FAQ from it (optionally overriding question/answer) and marks the suggestion accepted. The new FAQ still needs human approval to go live.",
    {
      id: z.number().int().positive(),
      question: z.string().max(500).optional(),
      answer: z.string().max(50_000).optional(),
    },
    async (args) => {
      const result = await svc().accept(args.id, actor.email, {
        question: args.question,
        answer: args.answer,
      });
      await cache().invalidateFaq();
      return jsonContent({ ...result, note: "FAQ created as draft pending review." });
    }
  );

  server.tool(
    "suggestion_dismiss",
    "Dismiss an AI suggestion with an optional reason.",
    { id: z.number().int().positive(), reason: z.string().max(2000).optional() },
    async (args) => jsonContent(await svc().dismiss(args.id, actor.email, args.reason))
  );

  server.tool(
    "suggestions_bulk_dismiss",
    "Dismiss many AI suggestions at once.",
    {
      ids: z.array(z.number().int().positive()).min(1),
      reason: z.string().max(2000).optional(),
    },
    async (args) => jsonContent(await svc().bulkDismiss(args.ids, actor.email, args.reason))
  );
}
