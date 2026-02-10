import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================
// FAQ Tables
// ============================================================

export const faqCategories = sqliteTable('faq_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const faqTags = sqliteTable('faq_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const faqEntries = sqliteTable('faq_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  categoryId: integer('category_id').references(() => faqCategories.id),
  liveVersionId: integer('live_version_id'),
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_faq_entries_category').on(table.categoryId),
  index('idx_faq_entries_slug').on(table.slug),
]);

export type FaqEntryStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

export const faqVersions = sqliteTable('faq_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entryId: integer('entry_id').notNull().references(() => faqEntries.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  searchKeywords: text('search_keywords'),
  status: text('status').$type<FaqEntryStatus>().notNull().default('draft'),
  rejectionNote: text('rejection_note'),
  authorEmail: text('author_email').notNull(),
  reviewerEmail: text('reviewer_email'),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_faq_versions_entry').on(table.entryId),
  index('idx_faq_versions_status').on(table.status),
]);

export const faqEntryTags = sqliteTable('faq_entry_tags', {
  entryId: integer('entry_id').notNull().references(() => faqEntries.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => faqTags.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_faq_entry_tags_unique').on(table.entryId, table.tagId),
]);

// ============================================================
// Glossary Tables
// ============================================================

export const glossaryCategories = sqliteTable('glossary_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const glossaryTerms = sqliteTable('glossary_terms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  term: text('term').notNull(),
  slug: text('slug').notNull().unique(),
  shortDefinition: text('short_definition').notNull(),
  longDefinition: text('long_definition'),
  abbreviation: text('abbreviation'),
  acronymExpansion: text('acronym_expansion'),
  alternateNames: text('alternate_names'), // JSON array
  categoryId: integer('category_id').references(() => glossaryCategories.id),
  exampleUsage: text('example_usage'),
  status: text('status').$type<'draft' | 'published'>().notNull().default('draft'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_glossary_terms_slug').on(table.slug),
  index('idx_glossary_terms_status').on(table.status),
  index('idx_glossary_terms_category').on(table.categoryId),
]);

export const termRelationships = sqliteTable('term_relationships', {
  termId: integer('term_id').notNull().references(() => glossaryTerms.id, { onDelete: 'cascade' }),
  relatedTermId: integer('related_term_id').notNull().references(() => glossaryTerms.id, { onDelete: 'cascade' }),
}, (table) => [
  uniqueIndex('idx_term_relationships_unique').on(table.termId, table.relatedTermId),
]);

// ============================================================
// Audit & Notifications
// ============================================================

export const faqAuditLog = sqliteTable('faq_audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entryId: integer('entry_id').references(() => faqEntries.id, { onDelete: 'set null' }),
  versionId: integer('version_id').references(() => faqVersions.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'created', 'submitted', 'approved', 'rejected', 'updated'
  actorEmail: text('actor_email').notNull(),
  details: text('details'), // JSON for extra context
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_audit_entry').on(table.entryId),
  index('idx_audit_actor').on(table.actorEmail),
]);

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recipientEmail: text('recipient_email').notNull(),
  type: text('type').notNull(), // 'review_requested', 'approved', 'rejected'
  title: text('title').notNull(),
  body: text('body'),
  linkUrl: text('link_url'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_notifications_recipient').on(table.recipientEmail),
  index('idx_notifications_unread').on(table.recipientEmail, table.isRead),
]);
