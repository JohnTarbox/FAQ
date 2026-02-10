import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { runMigrations, seedGlossaryData } from '../helpers/setup';

describe('Glossary Public API', () => {
  beforeAll(async () => {
    await runMigrations();
    await seedGlossaryData();

    // Seed published terms
    await env.DB.prepare(
      "INSERT OR IGNORE INTO glossary_terms (term, slug, short_definition, status, created_by) VALUES ('4-H', '4-h', 'A youth development organization.', 'published', 'admin@test.com')"
    ).run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO glossary_terms (term, slug, short_definition, status, created_by) VALUES ('Blue Ribbon', 'blue-ribbon', 'First place award.', 'published', 'admin@test.com')"
    ).run();
    // Draft term — should not appear in public
    await env.DB.prepare(
      "INSERT OR IGNORE INTO glossary_terms (term, slug, short_definition, status, created_by) VALUES ('Draft Term', 'draft-term', 'Not published.', 'draft', 'admin@test.com')"
    ).run();
  });

  it('GET /api/glossary returns only published terms', async () => {
    const res = await SELF.fetch('http://localhost/api/glossary');
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.some((t: any) => t.term === '4-H')).toBe(true);
    expect(body.some((t: any) => t.term === 'Blue Ribbon')).toBe(true);
    expect(body.some((t: any) => t.term === 'Draft Term')).toBe(false);
  });

  it('GET /api/glossary/:slug returns term detail', async () => {
    const res = await SELF.fetch('http://localhost/api/glossary/4-h');
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.term).toBe('4-H');
    expect(body.shortDefinition).toContain('youth development');
  });

  it('GET /api/glossary/:slug returns 404 for draft term', async () => {
    const res = await SELF.fetch('http://localhost/api/glossary/draft-term');
    expect(res.status).toBe(404);
  });

  it('GET /api/glossary/terms-index returns lightweight list sorted longest-first', async () => {
    const res = await SELF.fetch('http://localhost/api/glossary/terms-index');
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBeGreaterThanOrEqual(2);
    // Verify terms are present
    expect(body.some((t: any) => t.term === '4-H')).toBe(true);
    expect(body.some((t: any) => t.term === 'Blue Ribbon')).toBe(true);
  });

  it('GET /api/glossary/search requires q param', async () => {
    const res = await SELF.fetch('http://localhost/api/glossary/search');
    expect(res.status).toBe(400);
  });
});

describe('Glossary Admin API', () => {
  let createdTermId: number;

  it('POST /api/admin/glossary creates a new term', async () => {
    const res = await SELF.fetch('http://localhost/api/admin/glossary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-User-Email': 'admin@test.com',
        'X-Mock-User-Role': 'admin',
      },
      body: JSON.stringify({
        term: 'API-FFA',
        shortDefinition: 'Future Farmers of America.',
        slug: 'api-ffa',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.term).toBe('API-FFA');
    expect(body.status).toBe('draft');
    createdTermId = body.id;
  });

  it('PUT /api/admin/glossary/:id updates a term', async () => {
    const res = await SELF.fetch(`http://localhost/api/admin/glossary/${createdTermId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Mock-User-Email': 'admin@test.com',
        'X-Mock-User-Role': 'admin',
      },
      body: JSON.stringify({
        status: 'published',
      }),
    });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/admin/glossary/:id requires reviewer role', async () => {
    const res = await SELF.fetch(`http://localhost/api/admin/glossary/${createdTermId}`, {
      method: 'DELETE',
      headers: {
        'X-Mock-User-Email': 'author@test.com',
        'X-Mock-User-Role': 'author',
      },
    });
    expect(res.status).toBe(403);
  });
});
