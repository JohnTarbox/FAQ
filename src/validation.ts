import { z } from 'zod';
import type { Context } from 'hono';

// ============================================================
// Validation helper
// ============================================================

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns { success: true, data } or { success: false, response } (a 400 JSON error).
 */
export async function validateBody<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<{ success: true; data: z.infer<T> } | { success: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { success: false, response: c.json({ error: 'Invalid JSON body' }, 400) as unknown as Response };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return { success: false, response: c.json({ error: 'Validation failed', details: issues }, 400) as unknown as Response };
  }

  return { success: true, data: result.data };
}

// ============================================================
// FAQ Schemas
// ============================================================

export const createFaqSchema = z.object({
  question: z.string().min(1, 'question is required').max(500),
  answer: z.string().min(1, 'answer is required').max(50_000),
  slug: z.string().max(200).optional(),
  categoryId: z.number().int().positive().optional(),
  searchKeywords: z.string().max(1000).optional(),
  sourceUrl: z.string().url().max(2000).optional().or(z.literal('')),
  sourceTitle: z.string().max(500).optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

export const updateFaqEntrySchema = z.object({
  categoryId: z.number().int().positive().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  slug: z.string().max(200).optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

export const createFaqVersionSchema = z.object({
  question: z.string().min(1, 'question is required').max(500),
  answer: z.string().min(1, 'answer is required').max(50_000),
  searchKeywords: z.string().max(1000).optional(),
  sourceUrl: z.string().url().max(2000).optional().or(z.literal('')),
  sourceTitle: z.string().max(500).optional(),
});

export const rejectFaqSchema = z.object({
  note: z.string().min(1, 'Rejection note is required').max(2000),
});

// ============================================================
// Glossary Schemas
// ============================================================

export const createGlossarySchema = z.object({
  term: z.string().min(1, 'term is required').max(200),
  shortDefinition: z.string().min(1, 'shortDefinition is required').max(2000),
  longDefinition: z.string().max(50_000).optional(),
  abbreviation: z.string().max(50).optional(),
  acronymExpansion: z.string().max(500).optional(),
  alternateNames: z.array(z.string().max(200)).optional(),
  categoryId: z.number().int().positive().optional(),
  exampleUsage: z.string().max(5000).optional(),
  slug: z.string().max(200).optional(),
  relatedTermIds: z.array(z.number().int().positive()).optional(),
});

export const updateGlossarySchema = createGlossarySchema.partial().extend({
  status: z.enum(['draft', 'published']).optional(),
  relatedTermIds: z.array(z.number().int().positive()).optional(),
});

// ============================================================
// Category & Tag Schemas
// ============================================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createTagSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  slug: z.string().max(200).optional(),
});

// ============================================================
// Import Schemas
// ============================================================

export const importFaqSchema = z.object({
  items: z.array(z.object({
    question: z.string().min(1).max(500),
    answer: z.string().min(1).max(50_000),
    slug: z.string().max(200).optional(),
    categoryId: z.number().int().positive().optional(),
    searchKeywords: z.string().max(1000).optional(),
  })).min(1, 'items array must not be empty').max(100),
});

export const importGlossarySchema = z.object({
  items: z.array(z.object({
    term: z.string().min(1).max(200),
    shortDefinition: z.string().min(1).max(2000),
    longDefinition: z.string().max(50_000).optional(),
    abbreviation: z.string().max(50).optional(),
    acronymExpansion: z.string().max(500).optional(),
    alternateNames: z.array(z.string().max(200)).optional(),
    categoryId: z.number().int().positive().optional(),
    exampleUsage: z.string().max(5000).optional(),
    slug: z.string().max(200).optional(),
  })).min(1, 'items array must not be empty').max(100),
});

// ============================================================
// Suggestion Schemas
// ============================================================

export const createSearchTermSchema = z.object({
  term: z.string().min(1, 'term is required').max(200),
  sourceTypes: z.array(z.enum(['web', 'youtube', 'site'])).optional(),
});

export const updateSearchTermSchema = z.object({
  term: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  sourceTypes: z.array(z.enum(['web', 'youtube', 'site'])).optional(),
});

export const createKnownSiteSchema = z.object({
  url: z.string().url('Valid URL is required').max(2000),
  title: z.string().max(500).optional(),
});

export const updateKnownSiteSchema = z.object({
  url: z.string().url().max(2000).optional(),
  title: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const acceptSuggestionSchema = z.object({
  question: z.string().max(500).optional(),
  answer: z.string().max(50_000).optional(),
}).optional().default({});

export const dismissSuggestionSchema = z.object({
  reason: z.string().max(2000).optional(),
}).optional().default({});

export const bulkDismissSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids array is required'),
  reason: z.string().max(2000).optional(),
});

// ============================================================
// Glossary Category Schema
// ============================================================

export const createGlossaryCategorySchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  slug: z.string().max(200).optional(),
});
