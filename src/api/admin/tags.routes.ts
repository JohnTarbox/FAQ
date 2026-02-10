import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { AppEnv } from '../../index';
import { requireRole } from '../../middleware/auth';
import * as schema from '../../db/schema';

export const adminTagRoutes = new Hono<AppEnv>();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/tags
adminTagRoutes.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const tags = await db.select().from(schema.faqTags).orderBy(schema.faqTags.name).all();
  return c.json(tags);
});

// POST /api/admin/tags
adminTagRoutes.post('/', requireRole('reviewer'), async (c) => {
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  const db = drizzle(c.env.DB);
  const tag = await db.insert(schema.faqTags).values({
    name: body.name,
    slug: body.slug || slugify(body.name),
  }).returning().get();

  return c.json(tag, 201);
});

// DELETE /api/admin/tags/:id
adminTagRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const db = drizzle(c.env.DB);
  await db.delete(schema.faqTags).where(eq(schema.faqTags.id, id)).run();
  return c.json({ success: true });
});
