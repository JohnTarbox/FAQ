import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { FaqService } from '../../services/faq.service';
import { GlossaryService } from '../../services/glossary.service';
import { CacheService } from '../../services/cache.service';
import { requireRole } from '../../middleware/auth';
import { validateBody, importFaqSchema, importGlossarySchema } from '../../validation';

export const adminImportRoutes = new Hono<AppEnv>();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// POST /api/admin/import/faq — bulk import FAQs from JSON
adminImportRoutes.post('/faq', requireRole('admin'), async (c) => {
  const parsed = await validateBody(c, importFaqSchema);
  if (!parsed.success) return parsed.response;
  const { items } = parsed.data;
  const userEmail = c.get('userEmail');

  const svc = new FaqService(c.env.DB);
  const results = { created: 0, errors: [] as string[] };

  for (const item of items) {
    try {
      await svc.create({
        question: item.question,
        answer: item.answer,
        slug: item.slug || slugify(item.question),
        categoryId: item.categoryId,
        searchKeywords: item.searchKeywords,
        authorEmail: userEmail,
      });
      results.created++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Failed to import "${item.question}": ${msg}`);
    }
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateFaq();

  return c.json(results);
});

// POST /api/admin/import/glossary — bulk import glossary terms from JSON
adminImportRoutes.post('/glossary', requireRole('admin'), async (c) => {
  const parsed = await validateBody(c, importGlossarySchema);
  if (!parsed.success) return parsed.response;
  const { items } = parsed.data;
  const userEmail = c.get('userEmail');

  const svc = new GlossaryService(c.env.DB);
  const results = { created: 0, errors: [] as string[] };

  for (const item of items) {
    try {
      await svc.create({
        term: item.term,
        slug: item.slug || slugify(item.term),
        shortDefinition: item.shortDefinition,
        longDefinition: item.longDefinition,
        abbreviation: item.abbreviation,
        acronymExpansion: item.acronymExpansion,
        alternateNames: item.alternateNames,
        categoryId: item.categoryId,
        exampleUsage: item.exampleUsage,
        createdBy: userEmail,
      });
      results.created++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      results.errors.push(`Failed to import "${item.term}": ${msg}`);
    }
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateGlossary();

  return c.json(results);
});
