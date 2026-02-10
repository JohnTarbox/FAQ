import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { AppEnv } from '../../index';
import { requireRole } from '../../middleware/auth';
import * as schema from '../../db/schema';

export const adminCategoryRoutes = new Hono<AppEnv>();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/categories
adminCategoryRoutes.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const categories = await db.select().from(schema.faqCategories).orderBy(schema.faqCategories.sortOrder, schema.faqCategories.name).all();
  return c.json(categories);
});

// POST /api/admin/categories
adminCategoryRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  const db = drizzle(c.env.DB);
  const category = await db.insert(schema.faqCategories).values({
    name: body.name,
    slug: body.slug || slugify(body.name),
    description: body.description,
    sortOrder: body.sortOrder || 0,
  }).returning().get();

  return c.json(category, 201);
});

// PUT /api/admin/categories/:id
adminCategoryRoutes.put('/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  await db.update(schema.faqCategories).set({
    name: body.name,
    slug: body.slug,
    description: body.description,
    sortOrder: body.sortOrder,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.faqCategories.id, id)).run();

  return c.json({ success: true });
});

// DELETE /api/admin/categories/:id
adminCategoryRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const db = drizzle(c.env.DB);
  await db.delete(schema.faqCategories).where(eq(schema.faqCategories.id, id)).run();
  return c.json({ success: true });
});
