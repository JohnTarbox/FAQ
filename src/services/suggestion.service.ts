import { eq, and, desc, count, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import type { SuggestionStatus, DiscoveryLogEntry } from '../db/schema';
import { FaqService } from './faq.service';

export class SuggestionService {
  private db;
  private d1: D1Database;

  constructor(d1: D1Database) {
    this.d1 = d1;
    this.db = drizzle(d1, { schema });
  }

  async list(opts: {
    status?: SuggestionStatus;
    sourceType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (opts.status) conditions.push(eq(schema.faqSuggestions.status, opts.status));
    if (opts.sourceType) conditions.push(eq(schema.faqSuggestions.sourceType, opts.sourceType));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await this.db.select()
      .from(schema.faqSuggestions)
      .where(whereClause)
      .orderBy(desc(schema.faqSuggestions.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = await this.db.select({ count: count() })
      .from(schema.faqSuggestions)
      .where(whereClause)
      .get();

    return {
      items,
      total: totalResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((totalResult?.count || 0) / limit),
    };
  }

  async getById(id: number) {
    return this.db.select()
      .from(schema.faqSuggestions)
      .where(eq(schema.faqSuggestions.id, id))
      .get();
  }

  async accept(id: number, reviewerEmail: string, overrides?: { question?: string; answer?: string }) {
    const suggestion = await this.getById(id);
    if (!suggestion) throw new Error('Suggestion not found');
    if (suggestion.status !== 'new') throw new Error('Only new suggestions can be accepted');

    const faqService = new FaqService(this.d1);

    const question = overrides?.question || suggestion.question;
    const answer = overrides?.answer || suggestion.answer;

    const slug = question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);

    const result = await faqService.create({
      question,
      answer,
      slug: `ai-${slug}`,
      searchKeywords: suggestion.searchKeywords || undefined,
      sourceUrl: suggestion.sourceUrl || undefined,
      sourceTitle: suggestion.sourceTitle || undefined,
      authorEmail: reviewerEmail,
    });

    const now = new Date().toISOString();
    await this.db.update(schema.faqSuggestions)
      .set({
        status: 'accepted',
        reviewedBy: reviewerEmail,
        acceptedFaqEntryId: result.entry.id,
        updatedAt: now,
      })
      .where(eq(schema.faqSuggestions.id, id))
      .run();

    return { suggestion: { ...suggestion, status: 'accepted' as const }, faqEntry: result };
  }

  async dismiss(id: number, reviewerEmail: string, reason?: string) {
    const suggestion = await this.getById(id);
    if (!suggestion) throw new Error('Suggestion not found');
    if (suggestion.status !== 'new') throw new Error('Only new suggestions can be dismissed');

    const now = new Date().toISOString();
    await this.db.update(schema.faqSuggestions)
      .set({
        status: 'dismissed',
        reviewedBy: reviewerEmail,
        reviewNote: reason || null,
        updatedAt: now,
      })
      .where(eq(schema.faqSuggestions.id, id))
      .run();

    return { ...suggestion, status: 'dismissed' as const };
  }

  async bulkDismiss(ids: number[], reviewerEmail: string, reason?: string) {
    const now = new Date().toISOString();
    const results = [];

    for (const id of ids) {
      try {
        await this.db.update(schema.faqSuggestions)
          .set({
            status: 'dismissed',
            reviewedBy: reviewerEmail,
            reviewNote: reason || null,
            updatedAt: now,
          })
          .where(and(
            eq(schema.faqSuggestions.id, id),
            eq(schema.faqSuggestions.status, 'new'),
          ))
          .run();
        results.push({ id, success: true });
      } catch {
        results.push({ id, success: false });
      }
    }

    return results;
  }

  async getStats() {
    const rows = await this.db.select({
      status: schema.faqSuggestions.status,
      count: count(),
    })
      .from(schema.faqSuggestions)
      .groupBy(schema.faqSuggestions.status)
      .all();

    const stats: Record<string, number> = { new: 0, accepted: 0, dismissed: 0 };
    for (const row of rows) {
      stats[row.status] = row.count;
    }
    return stats;
  }

  async createFromAi(data: {
    question: string;
    answer: string;
    sourceUrl?: string;
    sourceTitle?: string;
    sourceType: string;
    sourceSnippet?: string;
    confidenceScore: number;
    suggestedCategory?: string;
    suggestedTags?: string;
    searchKeywords?: string;
    batchId: string;
  }) {
    return this.db.insert(schema.faqSuggestions)
      .values(data)
      .returning()
      .get();
  }

  // Discovery run management

  async createRun(triggeredBy: string, triggerType: string, batchId: string) {
    return this.db.insert(schema.faqDiscoveryRuns)
      .values({ triggeredBy, triggerType, batchId })
      .returning()
      .get();
  }

  async getRun(id: number) {
    return this.db.select()
      .from(schema.faqDiscoveryRuns)
      .where(eq(schema.faqDiscoveryRuns.id, id))
      .get();
  }

  async appendLog(runId: number, entry: DiscoveryLogEntry) {
    const run = await this.getRun(runId);
    if (!run) return;

    const entries: DiscoveryLogEntry[] = run.log ? JSON.parse(run.log) : [];
    entries.push(entry);

    await this.db.update(schema.faqDiscoveryRuns)
      .set({ log: JSON.stringify(entries) })
      .where(eq(schema.faqDiscoveryRuns.id, runId))
      .run();
  }

  async updateRunProgress(runId: number, sourcesChecked: number, suggestionsCreated: number) {
    await this.db.update(schema.faqDiscoveryRuns)
      .set({ sourcesChecked, suggestionsCreated })
      .where(eq(schema.faqDiscoveryRuns.id, runId))
      .run();
  }

  async completeRun(id: number, sourcesChecked: number, suggestionsCreated: number, errors?: string) {
    await this.db.update(schema.faqDiscoveryRuns)
      .set({
        status: 'completed',
        sourcesChecked,
        suggestionsCreated,
        errors: errors || null,
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.faqDiscoveryRuns.id, id))
      .run();
  }

  async failRun(id: number, errors: string) {
    await this.db.update(schema.faqDiscoveryRuns)
      .set({
        status: 'failed',
        errors,
        completedAt: new Date().toISOString(),
      })
      .where(eq(schema.faqDiscoveryRuns.id, id))
      .run();
  }

  async listRuns(limit = 20) {
    return this.db.select()
      .from(schema.faqDiscoveryRuns)
      .orderBy(desc(schema.faqDiscoveryRuns.startedAt))
      .limit(limit)
      .all();
  }

  // Search term management

  async getActiveSearchTerms() {
    return this.db.select()
      .from(schema.faqSearchTerms)
      .where(eq(schema.faqSearchTerms.isActive, true))
      .all();
  }

  async listSearchTerms() {
    return this.db.select()
      .from(schema.faqSearchTerms)
      .orderBy(schema.faqSearchTerms.term)
      .all();
  }

  async addSearchTerm(term: string, sourceTypes?: string[]) {
    return this.db.insert(schema.faqSearchTerms)
      .values({
        term,
        sourceTypes: sourceTypes ? JSON.stringify(sourceTypes) : undefined,
      })
      .returning()
      .get();
  }

  async updateSearchTerm(id: number, data: { term?: string; isActive?: boolean; sourceTypes?: string[] }) {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.term !== undefined) updates.term = data.term;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.sourceTypes !== undefined) updates.sourceTypes = JSON.stringify(data.sourceTypes);

    await this.db.update(schema.faqSearchTerms)
      .set(updates)
      .where(eq(schema.faqSearchTerms.id, id))
      .run();
  }

  async deleteSearchTerm(id: number) {
    await this.db.delete(schema.faqSearchTerms)
      .where(eq(schema.faqSearchTerms.id, id))
      .run();
  }

  // Discovery source dedup

  async isAlreadyProcessed(url: string): Promise<boolean> {
    const existing = await this.db.select()
      .from(schema.faqDiscoverySources)
      .where(eq(schema.faqDiscoverySources.url, url))
      .get();
    return !!existing;
  }

  async markProcessed(url: string, sourceType: string, title: string | null, suggestionsGenerated: number, batchId: string) {
    await this.db.insert(schema.faqDiscoverySources)
      .values({ url, sourceType, title, suggestionsGenerated, batchId })
      .run();
  }
}
