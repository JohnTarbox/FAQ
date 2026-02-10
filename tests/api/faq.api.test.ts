import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { runMigrations, seedFaqData } from '../helpers/setup';

describe('FAQ Public API', () => {
  beforeAll(async () => {
    await runMigrations();
    await seedFaqData();

    // Get the actual category ID
    const cat = await env.DB.prepare("SELECT id FROM faq_categories WHERE slug = 'tickets-pricing'").first<{ id: number }>();
    const catId = cat!.id;

    // Seed a published FAQ directly
    await env.DB.prepare(
      "INSERT OR IGNORE INTO faq_entries (slug, category_id, is_featured, sort_order, created_by) VALUES ('test-faq', ?, 1, 0, 'admin@test.com')"
    ).bind(catId).run();

    const entry = await env.DB.prepare("SELECT id FROM faq_entries WHERE slug = 'test-faq'").first<{ id: number }>();
    const entryId = entry!.id;

    await env.DB.prepare(
      "INSERT OR IGNORE INTO faq_versions (entry_id, version_number, question, answer, status, author_email, published_at) VALUES (?, 1, 'Test Question?', '<p>Test answer.</p>', 'published', 'admin@test.com', datetime('now'))"
    ).bind(entryId).run();

    const version = await env.DB.prepare("SELECT id FROM faq_versions WHERE entry_id = ? AND version_number = 1").bind(entryId).first<{ id: number }>();

    await env.DB.prepare(
      "UPDATE faq_entries SET live_version_id = ? WHERE id = ?"
    ).bind(version!.id, entryId).run();
  });

  it('GET /api/health returns ok', async () => {
    const res = await SELF.fetch('http://localhost/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /api/faq returns published FAQs', async () => {
    const res = await SELF.fetch('http://localhost/api/faq');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items.some((i: any) => i.question === 'Test Question?')).toBe(true);
  });

  it('GET /api/faq/:slug returns FAQ detail', async () => {
    const res = await SELF.fetch('http://localhost/api/faq/test-faq');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.question).toBe('Test Question?');
    expect(body.answer).toContain('Test answer');
  });

  it('GET /api/faq/:slug returns 404 for missing FAQ', async () => {
    const res = await SELF.fetch('http://localhost/api/faq/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /api/faq/categories returns categories', async () => {
    const res = await SELF.fetch('http://localhost/api/faq/categories');
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.some((c: any) => c.slug === 'tickets-pricing')).toBe(true);
  });

  it('GET /api/faq/search requires q param', async () => {
    const res = await SELF.fetch('http://localhost/api/faq/search');
    expect(res.status).toBe(400);
  });
});

describe('FAQ Admin API', () => {
  it('GET /api/admin/faq returns 401 without auth', async () => {
    const res = await SELF.fetch('http://localhost/api/admin/faq');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/faq returns list with mock auth', async () => {
    const res = await SELF.fetch('http://localhost/api/admin/faq', {
      headers: {
        'X-Mock-User-Email': 'admin@test.com',
        'X-Mock-User-Role': 'admin',
      },
    });
    expect(res.status).toBe(200);
  });

  it('POST /api/admin/faq creates a new FAQ', async () => {
    const res = await SELF.fetch('http://localhost/api/admin/faq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-User-Email': 'author@test.com',
        'X-Mock-User-Role': 'author',
      },
      body: JSON.stringify({
        question: 'New FAQ question?',
        answer: '<p>New answer</p>',
        slug: 'api-new-faq',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.entry.slug).toBe('api-new-faq');
    expect(body.version.status).toBe('draft');
  });

  it('POST /api/admin/faq returns 400 without required fields', async () => {
    const res = await SELF.fetch('http://localhost/api/admin/faq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-User-Email': 'author@test.com',
        'X-Mock-User-Role': 'author',
      },
      body: JSON.stringify({ question: 'Missing answer' }),
    });
    expect(res.status).toBe(400);
  });
});
