import { eq, and, desc, sql, like, count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export class GlossaryService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1, { schema });
  }

  async create(data: {
    term: string;
    slug: string;
    shortDefinition: string;
    longDefinition?: string;
    abbreviation?: string;
    acronymExpansion?: string;
    alternateNames?: string[];
    categoryId?: number;
    exampleUsage?: string;
    createdBy: string;
  }) {
    return this.db.insert(schema.glossaryTerms).values({
      ...data,
      alternateNames: data.alternateNames ? JSON.stringify(data.alternateNames) : null,
      status: 'draft',
    }).returning().get();
  }

  async getBySlug(slug: string) {
    const term = await this.db.select()
      .from(schema.glossaryTerms)
      .where(and(eq(schema.glossaryTerms.slug, slug), eq(schema.glossaryTerms.status, 'published')))
      .get();

    if (!term) return null;

    const related = await this.db.select({
      id: schema.glossaryTerms.id,
      term: schema.glossaryTerms.term,
      slug: schema.glossaryTerms.slug,
      shortDefinition: schema.glossaryTerms.shortDefinition,
    })
    .from(schema.termRelationships)
    .innerJoin(schema.glossaryTerms, eq(schema.termRelationships.relatedTermId, schema.glossaryTerms.id))
    .where(eq(schema.termRelationships.termId, term.id))
    .all();

    const category = term.categoryId
      ? await this.db.select().from(schema.glossaryCategories).where(eq(schema.glossaryCategories.id, term.categoryId)).get()
      : null;

    return {
      ...term,
      alternateNames: term.alternateNames ? JSON.parse(term.alternateNames) : [],
      relatedTerms: related,
      category,
    };
  }

  async getById(id: number) {
    const term = await this.db.select()
      .from(schema.glossaryTerms)
      .where(eq(schema.glossaryTerms.id, id))
      .get();

    if (!term) return null;

    const related = await this.db.select({
      id: schema.glossaryTerms.id,
      term: schema.glossaryTerms.term,
      slug: schema.glossaryTerms.slug,
    })
    .from(schema.termRelationships)
    .innerJoin(schema.glossaryTerms, eq(schema.termRelationships.relatedTermId, schema.glossaryTerms.id))
    .where(eq(schema.termRelationships.termId, id))
    .all();

    return {
      ...term,
      alternateNames: term.alternateNames ? JSON.parse(term.alternateNames) : [],
      relatedTerms: related,
    };
  }

  async listPublished() {
    const terms = await this.db.select()
      .from(schema.glossaryTerms)
      .where(eq(schema.glossaryTerms.status, 'published'))
      .orderBy(schema.glossaryTerms.term)
      .all();

    return terms.map(t => ({
      ...t,
      alternateNames: t.alternateNames ? JSON.parse(t.alternateNames) : [],
    }));
  }

  async listAll(opts: { status?: 'draft' | 'published'; categoryId?: number; search?: string; page?: number; limit?: number }) {
    const page = opts.page || 1;
    const limit = opts.limit || 50;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (opts.status) conditions.push(eq(schema.glossaryTerms.status, opts.status));
    if (opts.categoryId) conditions.push(eq(schema.glossaryTerms.categoryId, opts.categoryId));
    if (opts.search) conditions.push(like(schema.glossaryTerms.term, `%${opts.search}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db.select()
      .from(schema.glossaryTerms)
      .where(whereClause)
      .orderBy(schema.glossaryTerms.term)
      .limit(limit)
      .offset(offset)
      .all();

    return { items: items.map(t => ({ ...t, alternateNames: t.alternateNames ? JSON.parse(t.alternateNames) : [] })), page, limit };
  }

  async getTermsIndex() {
    // Lightweight list for tooltip widget — only published terms
    return this.db.select({
      id: schema.glossaryTerms.id,
      term: schema.glossaryTerms.term,
      slug: schema.glossaryTerms.slug,
      shortDefinition: schema.glossaryTerms.shortDefinition,
      abbreviation: schema.glossaryTerms.abbreviation,
      alternateNames: schema.glossaryTerms.alternateNames,
    })
    .from(schema.glossaryTerms)
    .where(eq(schema.glossaryTerms.status, 'published'))
    .orderBy(schema.glossaryTerms.term)
    .all();
  }

  async update(id: number, data: Partial<{
    term: string;
    slug: string;
    shortDefinition: string;
    longDefinition: string;
    abbreviation: string;
    acronymExpansion: string;
    alternateNames: string[];
    categoryId: number;
    exampleUsage: string;
    status: 'draft' | 'published';
  }>) {
    const { alternateNames, ...rest } = data;
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    // Only include defined values to avoid setting NOT NULL columns to null
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) updateData[key] = value;
    }

    if (alternateNames !== undefined) {
      updateData.alternateNames = JSON.stringify(alternateNames);
    }

    await this.db.update(schema.glossaryTerms)
      .set(updateData)
      .where(eq(schema.glossaryTerms.id, id))
      .run();
  }

  async setRelatedTerms(termId: number, relatedTermIds: number[]) {
    await this.db.delete(schema.termRelationships).where(eq(schema.termRelationships.termId, termId)).run();
    if (relatedTermIds.length > 0) {
      await this.db.insert(schema.termRelationships).values(
        relatedTermIds.map(relatedTermId => ({ termId, relatedTermId }))
      ).run();
    }
  }

  async deleteTerm(id: number) {
    await this.db.delete(schema.glossaryTerms).where(eq(schema.glossaryTerms.id, id)).run();
  }

  // Categories
  async listCategories() {
    return this.db.select().from(schema.glossaryCategories).orderBy(schema.glossaryCategories.name).all();
  }

  async createCategory(name: string, slug: string) {
    return this.db.insert(schema.glossaryCategories).values({ name, slug }).returning().get();
  }

  async deleteCategory(id: number) {
    await this.db.delete(schema.glossaryCategories).where(eq(schema.glossaryCategories.id, id)).run();
  }
}
