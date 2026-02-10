import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { GlossaryService } from '../services/glossary.service';
import { SearchService } from '../services/search.service';
import { CacheService } from '../services/cache.service';

export const glossaryRoutes = new Hono<AppEnv>();

// GET /api/glossary — all published terms
glossaryRoutes.get('/', async (c) => {
  const cache = new CacheService(c.env.CACHE);

  const cached = await cache.getGlossaryAll();
  if (cached) return c.json(cached);

  const svc = new GlossaryService(c.env.DB);
  const terms = await svc.listPublished();

  await cache.setGlossaryAll(terms);
  return c.json(terms);
});

// GET /api/glossary/search?q=
glossaryRoutes.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q || q.trim().length === 0) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  const search = new SearchService(c.env.DB);
  const results = await search.searchGlossary(q);

  return c.json({ query: q, results });
});

// GET /api/glossary/terms-index — lightweight list for tooltip widget
glossaryRoutes.get('/terms-index', async (c) => {
  const cache = new CacheService(c.env.CACHE);

  const cached = await cache.getTermsIndex();
  if (cached) return c.json(cached);

  const svc = new GlossaryService(c.env.DB);
  const terms = await svc.getTermsIndex();

  // Sort longest-first for greedy matching in tooltip widget
  const sorted = terms
    .flatMap(t => {
      const entries = [{ term: t.term, slug: t.slug, shortDefinition: t.shortDefinition }];
      if (t.abbreviation) entries.push({ term: t.abbreviation, slug: t.slug, shortDefinition: t.shortDefinition });
      const alts = t.alternateNames ? JSON.parse(t.alternateNames) : [];
      for (const alt of alts) {
        entries.push({ term: alt, slug: t.slug, shortDefinition: t.shortDefinition });
      }
      return entries;
    })
    .sort((a, b) => b.term.length - a.term.length);

  await cache.setTermsIndex(sorted);
  return c.json(sorted);
});

// GET /api/glossary/:slug
glossaryRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const cache = new CacheService(c.env.CACHE);

  const cached = await cache.getGlossaryBySlug(slug);
  if (cached) return c.json(cached);

  const svc = new GlossaryService(c.env.DB);
  const term = await svc.getBySlug(slug);

  if (!term) return c.json({ error: 'Term not found' }, 404);

  await cache.setGlossaryBySlug(slug, term);
  return c.json(term);
});
