import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { FaqService } from '../../services/faq.service';
import { GlossaryService } from '../../services/glossary.service';
import { CacheService } from '../../services/cache.service';
import { requireRole } from '../../middleware/auth';

export const adminImportRoutes = new Hono<AppEnv>();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// POST /api/admin/import/faq — bulk import FAQs from JSON
adminImportRoutes.post('/faq', requireRole('admin'), async (c) => {
  const body = await c.req.json();
  const userEmail = c.get('userEmail');

  if (!Array.isArray(body.items)) {
    return c.json({ error: 'items array is required' }, 400);
  }

  const svc = new FaqService(c.env.DB);
  const results = { created: 0, errors: [] as string[] };

  for (const item of body.items) {
    try {
      if (!item.question || !item.answer) {
        results.errors.push(`Missing question or answer: ${item.question || 'unknown'}`);
        continue;
      }
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
  const body = await c.req.json();
  const userEmail = c.get('userEmail');

  if (!Array.isArray(body.items)) {
    return c.json({ error: 'items array is required' }, 400);
  }

  const svc = new GlossaryService(c.env.DB);
  const results = { created: 0, errors: [] as string[] };

  for (const item of body.items) {
    try {
      if (!item.term || !item.shortDefinition) {
        results.errors.push(`Missing term or shortDefinition: ${item.term || 'unknown'}`);
        continue;
      }
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
