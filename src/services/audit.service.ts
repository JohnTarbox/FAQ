import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export class AuditService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1, { schema });
  }

  async listAll(opts: {
    page?: number;
    limit?: number;
    actorEmail?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 50, 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (opts.actorEmail) {
      conditions.push(eq(schema.faqAuditLog.actorEmail, opts.actorEmail));
    }
    if (opts.action) {
      conditions.push(eq(schema.faqAuditLog.action, opts.action));
    }
    if (opts.startDate) {
      conditions.push(gte(schema.faqAuditLog.createdAt, opts.startDate));
    }
    if (opts.endDate) {
      conditions.push(lte(schema.faqAuditLog.createdAt, opts.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db.select({
      id: schema.faqAuditLog.id,
      entryId: schema.faqAuditLog.entryId,
      versionId: schema.faqAuditLog.versionId,
      action: schema.faqAuditLog.action,
      actorEmail: schema.faqAuditLog.actorEmail,
      details: schema.faqAuditLog.details,
      createdAt: schema.faqAuditLog.createdAt,
      faqSlug: schema.faqEntries.slug,
    })
    .from(schema.faqAuditLog)
    .leftJoin(schema.faqEntries, eq(schema.faqAuditLog.entryId, schema.faqEntries.id))
    .where(whereClause)
    .orderBy(desc(schema.faqAuditLog.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

    const totalResult = await this.db.select({ count: sql<number>`count(*)` })
      .from(schema.faqAuditLog)
      .where(whereClause)
      .get();

    const total = totalResult?.count || 0;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
