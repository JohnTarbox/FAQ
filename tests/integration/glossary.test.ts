import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { GlossaryService } from '../../src/services/glossary.service';
import { runMigrations, seedGlossaryData } from '../helpers/setup';

describe('Glossary Service', () => {
  let svc: GlossaryService;
  let categoryId: number;
  let term1Id: number;
  let term2Id: number;

  beforeAll(async () => {
    await runMigrations();
    await seedGlossaryData();
    svc = new GlossaryService(env.DB);

    // Get seeded category ID
    const cat = await env.DB.prepare("SELECT id FROM glossary_categories WHERE slug = 'youth-programs'").first<{ id: number }>();
    categoryId = cat!.id;
  });

  it('creates a glossary term as draft', async () => {
    const term = await svc.create({
      term: 'Int-4-H',
      slug: 'int-4-h',
      shortDefinition: 'A national youth development organization.',
      longDefinition: '<p>4-H is one of the largest youth programs.</p>',
      abbreviation: '4-H',
      acronymExpansion: 'Head, Heart, Hands, Health',
      alternateNames: ['Four-H', '4H'],
      categoryId,
      exampleUsage: 'She has been in 4-H since age 5.',
      createdBy: 'admin@fair.example.com',
    });

    term1Id = term.id;
    expect(term.status).toBe('draft');
    expect(term.slug).toBe('int-4-h');
  });

  it('does not return draft terms in public list', async () => {
    const terms = await svc.listPublished();
    expect(terms.every(t => t.slug !== 'int-4-h')).toBe(true);
  });

  it('publishes a term and returns it in public list', async () => {
    await svc.update(term1Id, { status: 'published' });
    const terms = await svc.listPublished();
    expect(terms.some(t => t.slug === 'int-4-h')).toBe(true);
  });

  it('returns full detail by slug (published only)', async () => {
    const term = await svc.getBySlug('int-4-h');
    expect(term).not.toBeNull();
    expect(term!.term).toBe('Int-4-H');
    expect(term!.acronymExpansion).toBe('Head, Heart, Hands, Health');
    expect(term!.alternateNames).toEqual(['Four-H', '4H']);
  });

  it('returns null for unpublished slug', async () => {
    const created = await svc.create({
      term: 'Int-FFA',
      slug: 'int-ffa',
      shortDefinition: 'Future Farmers of America',
      createdBy: 'admin@fair.example.com',
    });

    term2Id = created.id;
    const term = await svc.getBySlug('int-ffa');
    expect(term).toBeNull();
  });

  it('creates and retrieves related terms', async () => {
    // Publish FFA
    await svc.update(term2Id, { status: 'published' });

    // Set 4-H related to FFA
    await svc.setRelatedTerms(term1Id, [term2Id]);

    const term = await svc.getBySlug('int-4-h');
    expect(term!.relatedTerms.length).toBe(1);
    expect(term!.relatedTerms[0].term).toBe('Int-FFA');
  });

  it('returns lightweight terms index for tooltip widget', async () => {
    const index = await svc.getTermsIndex();
    // At least our 2 published terms
    const ourTerms = index.filter(t => t.slug === 'int-4-h' || t.slug === 'int-ffa');
    expect(ourTerms.length).toBe(2);
    expect(ourTerms[0]).toHaveProperty('term');
    expect(ourTerms[0]).toHaveProperty('slug');
    expect(ourTerms[0]).toHaveProperty('shortDefinition');
  });

  it('deletes a term', async () => {
    await svc.deleteTerm(term2Id);
    const terms = await svc.listPublished();
    expect(terms.every(t => t.id !== term2Id)).toBe(true);
    expect(terms.some(t => t.slug === 'int-4-h')).toBe(true);
  });
});
