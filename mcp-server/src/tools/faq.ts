/**
 * FAQ tools. Reads are always registered; writes only when `actor.canWrite`.
 * All writes go through FaqService, which creates content as `draft` and writes
 * an audit row keyed by `actor.email` — so drafts-only is enforced by the
 * service, not re-implemented here. After every mutation we invalidate the KV
 * cache so the public read API serves fresh data (matching the admin routes).
 */
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FaqService } from "../../../src/services/faq.service";
import { SearchService } from "../../../src/services/search.service";
import { CacheService } from "../../../src/services/cache.service";
import * as schema from "../../../src/db/schema";
import {
  createFaqSchema,
  updateFaqEntrySchema,
  createFaqVersionSchema,
  createCategorySchema,
  createTagSchema,
} from "../../../src/validation";
import { jsonContent, errorContent, slugify, blankToUndefined } from "./common";
import type { Env } from "../env";
import type { Actor } from "../auth";

const FAQ_STATUS = z.enum(["draft", "pending_review", "published", "rejected"]);

export function registerFaqTools(server: McpServer, env: Env, actor: Actor): void {
  const svc = () => new FaqService(env.DB);
  const cache = () => new CacheService(env.CACHE);
  const db = () => drizzle(env.DB);

  // ---- Open reads (published / public content only) ----
  server.tool(
    "faq_list",
    "List FAQs. Authenticated callers get the admin view (all statuses, with filters and author/reviewer metadata); anonymous callers get published FAQs only.",
    {
      status: FAQ_STATUS.optional(),
      categoryId: z.number().int().positive().optional(),
      search: z.string().optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().positive().max(100).optional(),
    },
    async (args) => {
      if (actor.isAuthenticated) return jsonContent(await svc().listAll(args));
      // Anonymous: published-only, no author/reviewer emails — matches the
      // website's public API (FaqService.listPublished).
      return jsonContent(await svc().listPublished({ page: args.page, limit: args.limit }));
    }
  );

  server.tool(
    "faq_get",
    "Get a single published FAQ by slug. Authenticated callers may also fetch any entry (any status) by numeric id.",
    { id: z.number().int().positive().optional(), slug: z.string().optional() },
    async (args) => {
      if (args.id) {
        if (!actor.isAuthenticated) {
          return errorContent("Fetching by id requires authentication. Use `slug` for published FAQs.");
        }
        return jsonContent(await svc().getById(args.id));
      }
      if (args.slug) return jsonContent(await svc().getBySlug(args.slug));
      return errorContent("Provide either `id` or `slug`.");
    }
  );

  server.tool(
    "faq_search",
    "Full-text search published FAQs (FTS5 with porter stemming).",
    {
      query: z.string().min(1),
      limit: z.number().int().positive().max(100).optional(),
      offset: z.number().int().nonnegative().optional(),
    },
    async (args) =>
      jsonContent(await new SearchService(env.DB).searchFaq(args.query, args.limit, args.offset))
  );

  // ---- Internal reads (drafts, history, audit) — authenticated only ----
  if (actor.isAuthenticated) {
    server.tool(
      "faq_versions",
      "List all versions of a FAQ entry, newest first (includes drafts + author/reviewer emails).",
      { entryId: z.number().int().positive() },
      async (args) => jsonContent(await svc().getVersions(args.entryId))
    );

    server.tool(
      "faq_audit_log",
      "Get the audit log (created/updated/approved/...) for a FAQ entry (includes actor emails).",
      { entryId: z.number().int().positive() },
      async (args) => jsonContent(await svc().getAuditLog(args.entryId))
    );
  }

  server.tool("faq_categories_list", "List all FAQ categories.", {}, async () =>
    jsonContent(
      await db()
        .select()
        .from(schema.faqCategories)
        .orderBy(schema.faqCategories.sortOrder, schema.faqCategories.name)
        .all()
    )
  );

  server.tool("faq_tags_list", "List all FAQ tags.", {}, async () =>
    jsonContent(await db().select().from(schema.faqTags).orderBy(schema.faqTags.name).all())
  );

  if (!actor.canWrite) return;

  // ---- Writes (drafts only) ----
  server.tool(
    "faq_create",
    "Create a new FAQ. The content is saved as a DRAFT (version 1) for human review/approval in the admin UI — it does not go live until a reviewer approves it.",
    createFaqSchema.shape,
    async (args) => {
      const { entry, version } = await svc().create({
        question: args.question,
        answer: args.answer,
        slug: args.slug || slugify(args.question),
        categoryId: args.categoryId,
        searchKeywords: args.searchKeywords,
        sourceUrl: blankToUndefined(args.sourceUrl),
        sourceTitle: args.sourceTitle,
        authorEmail: actor.email,
      });
      if (args.tagIds?.length) await svc().setTags(entry.id, args.tagIds);
      await cache().invalidateFaq();
      return jsonContent({ entry, version, note: "Created as draft pending review." });
    }
  );

  server.tool(
    "faq_create_version",
    "Create a new DRAFT version of an existing FAQ entry (the edit workflow). The current published version stays live until a reviewer approves the new draft.",
    { entryId: z.number().int().positive(), ...createFaqVersionSchema.shape },
    async (args) => {
      const version = await svc().createNewVersion(args.entryId, {
        question: args.question,
        answer: args.answer,
        searchKeywords: args.searchKeywords,
        sourceUrl: blankToUndefined(args.sourceUrl),
        sourceTitle: args.sourceTitle,
        authorEmail: actor.email,
      });
      await cache().invalidateFaq();
      return jsonContent({ version, note: "New draft version created pending review." });
    }
  );

  server.tool(
    "faq_update_entry",
    "Update FAQ entry metadata only (category, featured flag, sort order, slug, tags). Does not change published content — use faq_create_version for content edits.",
    { id: z.number().int().positive(), ...updateFaqEntrySchema.shape },
    async (args) => {
      await svc().updateEntry(args.id, {
        categoryId: args.categoryId,
        isFeatured: args.isFeatured,
        sortOrder: args.sortOrder,
        slug: args.slug,
      });
      if (args.tagIds) await svc().setTags(args.id, args.tagIds);
      await cache().invalidateFaq();
      return jsonContent({ success: true });
    }
  );

  server.tool(
    "faq_set_tags",
    "Replace the full tag set on a FAQ entry.",
    { entryId: z.number().int().positive(), tagIds: z.array(z.number().int().positive()) },
    async (args) => {
      await svc().setTags(args.entryId, args.tagIds);
      await cache().invalidateFaq();
      return jsonContent({ success: true });
    }
  );

  server.tool(
    "faq_delete",
    "Delete a FAQ entry and all its versions (cascade). Logs an audit entry. Irreversible.",
    { entryId: z.number().int().positive() },
    async (args) => {
      await svc().deleteEntry(args.entryId, actor.email);
      await cache().invalidateFaq();
      return jsonContent({ success: true, deletedEntryId: args.entryId });
    }
  );

  server.tool(
    "faq_category_create",
    "Create a FAQ category.",
    createCategorySchema.shape,
    async (args) => {
      const category = await db()
        .insert(schema.faqCategories)
        .values({
          name: args.name,
          slug: args.slug || slugify(args.name),
          description: args.description,
          sortOrder: args.sortOrder ?? 0,
        })
        .returning()
        .get();
      await cache().invalidateFaq();
      return jsonContent(category);
    }
  );

  server.tool("faq_tag_create", "Create a FAQ tag.", createTagSchema.shape, async (args) => {
    const tag = await db()
      .insert(schema.faqTags)
      .values({ name: args.name, slug: args.slug || slugify(args.name) })
      .returning()
      .get();
    await cache().invalidateFaq();
    return jsonContent(tag);
  });
}
