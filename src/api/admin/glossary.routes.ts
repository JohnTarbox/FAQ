import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { GlossaryService } from '../../services/glossary.service';
import { CacheService } from '../../services/cache.service';
import { requireRole } from '../../middleware/auth';

export const adminGlossaryRoutes = new Hono<AppEnv>();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/glossary — list all terms
adminGlossaryRoutes.get('/', async (c) => {
  const svc = new GlossaryService(c.env.DB);
  const status = c.req.query('status') as 'draft' | 'published' | undefined;
  const categoryId = c.req.query('categoryId') ? Number(c.req.query('categoryId')) : undefined;
  const search = c.req.query('search');
  const page = Number(c.req.query('page')) || 1;

  const result = await svc.listAll({ status, categoryId, search, page });
  return c.json(result);
});

// GET /api/admin/glossary/:id
adminGlossaryRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new GlossaryService(c.env.DB);
  const term = await svc.getById(id);
  if (!term) return c.json({ error: 'Term not found' }, 404);
  return c.json(term);
});

// POST /api/admin/glossary — create new term
adminGlossaryRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const userEmail = c.get('userEmail');

  if (!body.term || !body.shortDefinition) {
    return c.json({ error: 'term and shortDefinition are required' }, 400);
  }

  const svc = new GlossaryService(c.env.DB);
  const slug = body.slug || slugify(body.term);

  const term = await svc.create({
    term: body.term,
    slug,
    shortDefinition: body.shortDefinition,
    longDefinition: body.longDefinition,
    abbreviation: body.abbreviation,
    acronymExpansion: body.acronymExpansion,
    alternateNames: body.alternateNames,
    categoryId: body.categoryId,
    exampleUsage: body.exampleUsage,
    createdBy: userEmail,
  });

  if (body.relatedTermIds) {
    await svc.setRelatedTerms(term.id, body.relatedTermIds);
  }

  return c.json(term, 201);
});

// PUT /api/admin/glossary/:id — update term
adminGlossaryRoutes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();

  const svc = new GlossaryService(c.env.DB);
  const existing = await svc.getById(id);
  if (!existing) return c.json({ error: 'Term not found' }, 404);

  await svc.update(id, {
    term: body.term,
    slug: body.slug,
    shortDefinition: body.shortDefinition,
    longDefinition: body.longDefinition,
    abbreviation: body.abbreviation,
    acronymExpansion: body.acronymExpansion,
    alternateNames: body.alternateNames,
    categoryId: body.categoryId,
    exampleUsage: body.exampleUsage,
    status: body.status,
  });

  if (body.relatedTermIds) {
    await svc.setRelatedTerms(id, body.relatedTermIds);
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateGlossary();

  return c.json({ success: true });
});

// DELETE /api/admin/glossary/:id
adminGlossaryRoutes.delete('/:id', requireRole('reviewer'), async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new GlossaryService(c.env.DB);

  const existing = await svc.getById(id);
  if (!existing) return c.json({ error: 'Term not found' }, 404);

  await svc.deleteTerm(id);

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateGlossary();

  return c.json({ success: true });
});

// Glossary categories
adminGlossaryRoutes.get('/categories', async (c) => {
  const svc = new GlossaryService(c.env.DB);
  const categories = await svc.listCategories();
  return c.json(categories);
});

adminGlossaryRoutes.post('/categories', requireRole('admin'), async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  const svc = new GlossaryService(c.env.DB);
  const slug = body.slug || slugify(body.name);
  const category = await svc.createCategory(body.name, slug);
  return c.json(category, 201);
});

adminGlossaryRoutes.delete('/categories/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new GlossaryService(c.env.DB);
  await svc.deleteCategory(id);
  return c.json({ success: true });
});
