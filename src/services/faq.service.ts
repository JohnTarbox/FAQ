import { eq, and, desc, sql, like, count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import type { FaqEntryStatus } from '../db/schema';

export class FaqService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1, { schema });
  }

  async create(data: {
    question: string;
    answer: string;
    slug: string;
    categoryId?: number;
    searchKeywords?: string;
    authorEmail: string;
  }) {
    const entry = await this.db.insert(schema.faqEntries).values({
      slug: data.slug,
      categoryId: data.categoryId,
      createdBy: data.authorEmail,
    }).returning().get();

    const version = await this.db.insert(schema.faqVersions).values({
      entryId: entry.id,
      versionNumber: 1,
      question: data.question,
      answer: data.answer,
      searchKeywords: data.searchKeywords,
      status: 'draft',
      authorEmail: data.authorEmail,
    }).returning().get();

    await this.logAudit(entry.id, version.id, 'created', data.authorEmail);

    return { entry, version };
  }

  async getById(id: number) {
    return this.db.select()
      .from(schema.faqEntries)
      .where(eq(schema.faqEntries.id, id))
      .get();
  }

  async getBySlug(slug: string) {
    const entry = await this.db.select()
      .from(schema.faqEntries)
      .where(eq(schema.faqEntries.slug, slug))
      .get();

    if (!entry || !entry.liveVersionId) return null;

    const version = await this.db.select()
      .from(schema.faqVersions)
      .where(eq(schema.faqVersions.id, entry.liveVersionId))
      .get();

    if (!version) return null;

    const category = entry.categoryId
      ? await this.db.select().from(schema.faqCategories).where(eq(schema.faqCategories.id, entry.categoryId)).get()
      : null;

    const tags = await this.db.select({ name: schema.faqTags.name, slug: schema.faqTags.slug })
      .from(schema.faqEntryTags)
      .innerJoin(schema.faqTags, eq(schema.faqEntryTags.tagId, schema.faqTags.id))
      .where(eq(schema.faqEntryTags.entryId, entry.id))
      .all();

    return { ...entry, question: version.question, answer: version.answer, version, category, tags };
  }

  async listPublished(opts: { categorySlug?: string; tagSlug?: string; page?: number; limit?: number }) {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const offset = (page - 1) * limit;

    let query = this.db.select({
      id: schema.faqEntries.id,
      slug: schema.faqEntries.slug,
      isFeatured: schema.faqEntries.isFeatured,
      sortOrder: schema.faqEntries.sortOrder,
      categoryId: schema.faqEntries.categoryId,
      question: schema.faqVersions.question,
      answer: schema.faqVersions.answer,
      updatedAt: schema.faqVersions.updatedAt,
    })
    .from(schema.faqEntries)
    .innerJoin(schema.faqVersions, eq(schema.faqEntries.liveVersionId, schema.faqVersions.id))
    .$dynamic();

    if (opts.categorySlug) {
      const cat = await this.db.select().from(schema.faqCategories)
        .where(eq(schema.faqCategories.slug, opts.categorySlug)).get();
      if (cat) {
        query = query.where(eq(schema.faqEntries.categoryId, cat.id));
      }
    }

    const items = await query
      .orderBy(desc(schema.faqEntries.isFeatured), schema.faqEntries.sortOrder)
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = await this.db.select({ count: count() })
      .from(schema.faqEntries)
      .where(sql`${schema.faqEntries.liveVersionId} IS NOT NULL`)
      .get();

    return {
      items,
      total: totalResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((totalResult?.count || 0) / limit),
    };
  }

  async listAll(opts: { status?: FaqEntryStatus; categoryId?: number; page?: number; limit?: number; search?: string }) {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const offset = (page - 1) * limit;

    // Get latest version for each entry
    const conditions = [];
    if (opts.status) {
      conditions.push(eq(schema.faqVersions.status, opts.status));
    }
    if (opts.categoryId) {
      conditions.push(eq(schema.faqEntries.categoryId, opts.categoryId));
    }
    if (opts.search) {
      conditions.push(like(schema.faqVersions.question, `%${opts.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db.select({
      id: schema.faqEntries.id,
      slug: schema.faqEntries.slug,
      isFeatured: schema.faqEntries.isFeatured,
      categoryId: schema.faqEntries.categoryId,
      createdBy: schema.faqEntries.createdBy,
      question: schema.faqVersions.question,
      status: schema.faqVersions.status,
      versionNumber: schema.faqVersions.versionNumber,
      authorEmail: schema.faqVersions.authorEmail,
      updatedAt: schema.faqVersions.updatedAt,
    })
    .from(schema.faqEntries)
    .innerJoin(schema.faqVersions, and(
      eq(schema.faqVersions.entryId, schema.faqEntries.id),
      eq(schema.faqVersions.id, sql`(SELECT MAX(id) FROM faq_versions WHERE entry_id = ${schema.faqEntries.id})`)
    ))
    .where(whereClause)
    .orderBy(desc(schema.faqVersions.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();

    return { items, page, limit };
  }

  async getLatestVersion(entryId: number) {
    return this.db.select()
      .from(schema.faqVersions)
      .where(eq(schema.faqVersions.entryId, entryId))
      .orderBy(desc(schema.faqVersions.versionNumber))
      .limit(1)
      .get();
  }

  async getVersions(entryId: number) {
    return this.db.select()
      .from(schema.faqVersions)
      .where(eq(schema.faqVersions.entryId, entryId))
      .orderBy(desc(schema.faqVersions.versionNumber))
      .all();
  }

  async createNewVersion(entryId: number, data: {
    question: string;
    answer: string;
    searchKeywords?: string;
    authorEmail: string;
  }) {
    const latest = await this.getLatestVersion(entryId);
    const nextVersion = (latest?.versionNumber || 0) + 1;

    const version = await this.db.insert(schema.faqVersions).values({
      entryId,
      versionNumber: nextVersion,
      question: data.question,
      answer: data.answer,
      searchKeywords: data.searchKeywords,
      status: 'draft',
      authorEmail: data.authorEmail,
    }).returning().get();

    await this.db.update(schema.faqEntries)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(schema.faqEntries.id, entryId))
      .run();

    await this.logAudit(entryId, version.id, 'updated', data.authorEmail);

    return version;
  }

  async submitForReview(versionId: number, actorEmail: string) {
    const version = await this.db.select().from(schema.faqVersions)
      .where(eq(schema.faqVersions.id, versionId)).get();

    if (!version) throw new Error('Version not found');
    if (version.status !== 'draft') throw new Error('Only drafts can be submitted for review');

    await this.db.update(schema.faqVersions)
      .set({ status: 'pending_review', updatedAt: new Date().toISOString() })
      .where(eq(schema.faqVersions.id, versionId))
      .run();

    await this.logAudit(version.entryId, versionId, 'submitted', actorEmail);

    return { ...version, status: 'pending_review' as const };
  }

  async approve(versionId: number, reviewerEmail: string) {
    const version = await this.db.select().from(schema.faqVersions)
      .where(eq(schema.faqVersions.id, versionId)).get();

    if (!version) throw new Error('Version not found');
    if (version.status !== 'pending_review') throw new Error('Only pending versions can be approved');
    if (version.authorEmail === reviewerEmail) throw new Error('Cannot approve your own submission');

    const now = new Date().toISOString();

    await this.db.update(schema.faqVersions)
      .set({ status: 'published', reviewerEmail, publishedAt: now, updatedAt: now })
      .where(eq(schema.faqVersions.id, versionId))
      .run();

    await this.db.update(schema.faqEntries)
      .set({ liveVersionId: versionId, updatedAt: now })
      .where(eq(schema.faqEntries.id, version.entryId))
      .run();

    await this.logAudit(version.entryId, versionId, 'approved', reviewerEmail);

    return { ...version, status: 'published' as const };
  }

  async reject(versionId: number, reviewerEmail: string, note: string) {
    const version = await this.db.select().from(schema.faqVersions)
      .where(eq(schema.faqVersions.id, versionId)).get();

    if (!version) throw new Error('Version not found');
    if (version.status !== 'pending_review') throw new Error('Only pending versions can be rejected');

    await this.db.update(schema.faqVersions)
      .set({ status: 'draft', reviewerEmail, rejectionNote: note, updatedAt: new Date().toISOString() })
      .where(eq(schema.faqVersions.id, versionId))
      .run();

    await this.logAudit(version.entryId, versionId, 'rejected', reviewerEmail, JSON.stringify({ note }));

    return { ...version, status: 'draft' as const };
  }

  async updateEntry(entryId: number, data: {
    categoryId?: number;
    isFeatured?: boolean;
    sortOrder?: number;
    slug?: string;
  }) {
    await this.db.update(schema.faqEntries)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(schema.faqEntries.id, entryId))
      .run();
  }

  async setTags(entryId: number, tagIds: number[]) {
    await this.db.delete(schema.faqEntryTags).where(eq(schema.faqEntryTags.entryId, entryId)).run();
    if (tagIds.length > 0) {
      await this.db.insert(schema.faqEntryTags).values(
        tagIds.map(tagId => ({ entryId, tagId }))
      ).run();
    }
  }

  async deleteEntry(entryId: number, actorEmail: string) {
    await this.logAudit(entryId, null, 'deleted', actorEmail);
    await this.db.delete(schema.faqEntries).where(eq(schema.faqEntries.id, entryId)).run();
  }

  async getAuditLog(entryId: number) {
    return this.db.select()
      .from(schema.faqAuditLog)
      .where(eq(schema.faqAuditLog.entryId, entryId))
      .orderBy(desc(schema.faqAuditLog.createdAt))
      .all();
  }

  private async logAudit(
    entryId: number,
    versionId: number | null,
    action: string,
    actorEmail: string,
    details?: string
  ) {
    await this.db.insert(schema.faqAuditLog).values({
      entryId,
      versionId,
      action,
      actorEmail,
      details,
    }).run();
  }
}
