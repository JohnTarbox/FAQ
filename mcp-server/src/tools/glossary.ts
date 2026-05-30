/**
 * Glossary tools. Drafts-only is enforced two ways:
 *   - glossary_create never sets status; GlossaryService.create() hardcodes
 *     status='draft'.
 *   - glossary_update OMITS the `status` field from its input schema, so an
 *     agent structurally cannot publish a term (publishing stays in the admin
 *     UI). `updateGlossarySchema.omit({ status: true })` makes that guarantee
 *     visible in tools/list.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GlossaryService } from "../../../src/services/glossary.service";
import { SearchService } from "../../../src/services/search.service";
import { CacheService } from "../../../src/services/cache.service";
import {
  createGlossarySchema,
  updateGlossarySchema,
  createGlossaryCategorySchema,
} from "../../../src/validation";
import { jsonContent, errorContent, slugify } from "./common";
import type { Env } from "../env";
import type { Actor } from "../auth";

// Drafts-only: strip the publish lever before exposing the update shape.
const glossaryUpdateShape = updateGlossarySchema.omit({ status: true }).shape;

export function registerGlossaryTools(server: McpServer, env: Env, actor: Actor): void {
  const svc = () => new GlossaryService(env.DB);
  const cache = () => new CacheService(env.CACHE);

  // ---- Open reads (published / public content only) ----
  server.tool(
    "glossary_list",
    "List glossary terms. Authenticated callers get the admin view (all statuses + filters); anonymous callers get published terms only.",
    {
      status: z.enum(["draft", "published"]).optional(),
      categoryId: z.number().int().positive().optional(),
      search: z.string().optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
    async (args) => {
      if (actor.isAuthenticated) return jsonContent(await svc().listAll(args));
      // Anonymous: published-only, matching the website's public API.
      return jsonContent(await svc().listPublished());
    }
  );

  server.tool(
    "glossary_get",
    "Get a single published glossary term by slug. Authenticated callers may also fetch any term (any status) by numeric id.",
    { id: z.number().int().positive().optional(), slug: z.string().optional() },
    async (args) => {
      if (args.id) {
        if (!actor.isAuthenticated) {
          return errorContent("Fetching by id requires authentication. Use `slug` for published terms.");
        }
        return jsonContent(await svc().getById(args.id));
      }
      if (args.slug) return jsonContent(await svc().getBySlug(args.slug));
      return errorContent("Provide either `id` or `slug`.");
    }
  );

  server.tool(
    "glossary_search",
    "Full-text search published glossary terms (FTS5 with porter stemming).",
    {
      query: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    async (args) =>
      jsonContent(await new SearchService(env.DB).searchGlossary(args.query, args.limit, args.offset))
  );

  server.tool("glossary_categories_list", "List glossary categories.", {}, async () =>
    jsonContent(await svc().listCategories())
  );

  if (!actor.canWrite) return;

  // ---- Writes (drafts only) ----
  server.tool(
    "glossary_create",
    "Create a glossary term. Saved as a DRAFT (status='draft') for human review — a person publishes it from the admin UI.",
    createGlossarySchema.shape,
    async (args) => {
      const term = await svc().create({
        term: args.term,
        slug: args.slug || slugify(args.term),
        shortDefinition: args.shortDefinition,
        longDefinition: args.longDefinition,
        abbreviation: args.abbreviation,
        acronymExpansion: args.acronymExpansion,
        alternateNames: args.alternateNames,
        categoryId: args.categoryId,
        exampleUsage: args.exampleUsage,
        createdBy: actor.email,
      });
      if (args.relatedTermIds?.length) await svc().setRelatedTerms(term.id, args.relatedTermIds);
      await cache().invalidateGlossary();
      return jsonContent({ term, note: "Created as draft pending review." });
    }
  );

  server.tool(
    "glossary_update",
    "Update a glossary term's content/metadata. Cannot change publication status (that stays in the admin UI).",
    { id: z.number().int().positive(), ...glossaryUpdateShape },
    async (args) => {
      const { id, relatedTermIds, ...data } = args;
      await svc().update(id, data);
      if (relatedTermIds) await svc().setRelatedTerms(id, relatedTermIds);
      await cache().invalidateGlossary();
      return jsonContent({ success: true });
    }
  );

  server.tool(
    "glossary_set_related",
    "Replace the set of related terms for a glossary term.",
    { termId: z.number().int().positive(), relatedTermIds: z.array(z.number().int().positive()) },
    async (args) => {
      await svc().setRelatedTerms(args.termId, args.relatedTermIds);
      await cache().invalidateGlossary();
      return jsonContent({ success: true });
    }
  );

  server.tool(
    "glossary_delete",
    "Delete a glossary term (cascade removes relationships). Irreversible.",
    { id: z.number().int().positive() },
    async (args) => {
      await svc().deleteTerm(args.id);
      await cache().invalidateGlossary();
      return jsonContent({ success: true, deletedTermId: args.id });
    }
  );

  server.tool(
    "glossary_category_create",
    "Create a glossary category.",
    createGlossaryCategorySchema.shape,
    async (args) => {
      const category = await svc().createCategory(args.name, args.slug || slugify(args.name));
      await cache().invalidateGlossary();
      return jsonContent(category);
    }
  );
}
