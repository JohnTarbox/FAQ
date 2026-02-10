import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { FaqService } from '../services/faq.service';
import { SearchService } from '../services/search.service';
import { CacheService } from '../services/cache.service';

export const faqRoutes = new Hono<AppEnv>();

// GET /api/faq — paginated list of published FAQs
faqRoutes.get('/', async (c) => {
  const cache = new CacheService(c.env.CACHE);
  const page = Number(c.req.query('page')) || 1;
  const category = c.req.query('category');

  const cached = await cache.getFaqList(page, category);
  if (cached) return c.json(cached);

  const svc = new FaqService(c.env.DB);
  const result = await svc.listPublished({ categorySlug: category, page });

  await cache.setFaqList(page, category, result);
  return c.json(result);
});

// GET /api/faq/search?q=
faqRoutes.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q || q.trim().length === 0) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }

  const search = new SearchService(c.env.DB);
  const limit = Number(c.req.query('limit')) || 20;
  const offset = Number(c.req.query('offset')) || 0;
  const results = await search.searchFaq(q, limit, offset);

  return c.json({ query: q, results });
});

// GET /api/faq/categories
faqRoutes.get('/categories', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT id, name, slug, description, sort_order FROM faq_categories ORDER BY sort_order, name'
  ).all();
  return c.json(result.results || []);
});

// GET /api/faq/:slug
faqRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const cache = new CacheService(c.env.CACHE);

  const cached = await cache.getFaqBySlug(slug);
  if (cached) return c.json(cached);

  const svc = new FaqService(c.env.DB);
  const faq = await svc.getBySlug(slug);

  if (!faq) return c.json({ error: 'FAQ not found' }, 404);

  await cache.setFaqBySlug(slug, faq);
  return c.json(faq);
});
