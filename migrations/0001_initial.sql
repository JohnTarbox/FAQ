-- FAQ & Glossary Schema
-- Migration: 0001_initial

-- ============================================================
-- FAQ Categories
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- FAQ Tags
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- FAQ Entries (header — stable identity)
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES faq_categories(id),
  live_version_id INTEGER,
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_faq_entries_category ON faq_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_faq_entries_slug ON faq_entries(slug);

-- ============================================================
-- FAQ Versions (content — versioned for maker-checker)
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES faq_entries(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  search_keywords TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  rejection_note TEXT,
  author_email TEXT NOT NULL,
  reviewer_email TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_faq_versions_entry ON faq_versions(entry_id);
CREATE INDEX IF NOT EXISTS idx_faq_versions_status ON faq_versions(status);

-- ============================================================
-- FAQ Entry-Tag join table
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_entry_tags (
  entry_id INTEGER NOT NULL REFERENCES faq_entries(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES faq_tags(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_entry_tags_unique ON faq_entry_tags(entry_id, tag_id);

-- ============================================================
-- Glossary Categories
-- ============================================================
CREATE TABLE IF NOT EXISTS glossary_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Glossary Terms
-- ============================================================
CREATE TABLE IF NOT EXISTS glossary_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_definition TEXT NOT NULL,
  long_definition TEXT,
  abbreviation TEXT,
  acronym_expansion TEXT,
  alternate_names TEXT,
  category_id INTEGER REFERENCES glossary_categories(id),
  example_usage TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_slug ON glossary_terms(slug);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_status ON glossary_terms(status);
CREATE INDEX IF NOT EXISTS idx_glossary_terms_category ON glossary_terms(category_id);

-- ============================================================
-- Term Relationships (many-to-many self-join)
-- ============================================================
CREATE TABLE IF NOT EXISTS term_relationships (
  term_id INTEGER NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE,
  related_term_id INTEGER NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_term_relationships_unique ON term_relationships(term_id, related_term_id);

-- ============================================================
-- Audit Log
-- ============================================================
CREATE TABLE IF NOT EXISTS faq_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER REFERENCES faq_entries(id) ON DELETE SET NULL,
  version_id INTEGER REFERENCES faq_versions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entry ON faq_audit_log(entry_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON faq_audit_log(actor_email);

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_email TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_email, is_read);

-- ============================================================
-- FTS5 Virtual Tables for Full-Text Search
-- ============================================================
CREATE VIRTUAL TABLE IF NOT EXISTS faq_fts USING fts5(
  question,
  answer,
  search_keywords,
  content='faq_versions',
  content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS glossary_fts USING fts5(
  term,
  short_definition,
  long_definition,
  abbreviation,
  alternate_names,
  content='glossary_terms',
  content_rowid='id'
);

-- FTS triggers to keep FTS tables in sync
CREATE TRIGGER IF NOT EXISTS faq_versions_ai AFTER INSERT ON faq_versions BEGIN
  INSERT INTO faq_fts(rowid, question, answer, search_keywords)
  VALUES (new.id, new.question, new.answer, new.search_keywords);
END;

CREATE TRIGGER IF NOT EXISTS faq_versions_ad AFTER DELETE ON faq_versions BEGIN
  INSERT INTO faq_fts(faq_fts, rowid, question, answer, search_keywords)
  VALUES ('delete', old.id, old.question, old.answer, old.search_keywords);
END;

CREATE TRIGGER IF NOT EXISTS faq_versions_au AFTER UPDATE ON faq_versions BEGIN
  INSERT INTO faq_fts(faq_fts, rowid, question, answer, search_keywords)
  VALUES ('delete', old.id, old.question, old.answer, old.search_keywords);
  INSERT INTO faq_fts(rowid, question, answer, search_keywords)
  VALUES (new.id, new.question, new.answer, new.search_keywords);
END;

CREATE TRIGGER IF NOT EXISTS glossary_terms_ai AFTER INSERT ON glossary_terms BEGIN
  INSERT INTO glossary_fts(rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES (new.id, new.term, new.short_definition, new.long_definition, new.abbreviation, new.alternate_names);
END;

CREATE TRIGGER IF NOT EXISTS glossary_terms_ad AFTER DELETE ON glossary_terms BEGIN
  INSERT INTO glossary_fts(glossary_fts, rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES ('delete', old.id, old.term, old.short_definition, old.long_definition, old.abbreviation, old.alternate_names);
END;

CREATE TRIGGER IF NOT EXISTS glossary_terms_au AFTER UPDATE ON glossary_terms BEGIN
  INSERT INTO glossary_fts(glossary_fts, rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES ('delete', old.id, old.term, old.short_definition, old.long_definition, old.abbreviation, old.alternate_names);
  INSERT INTO glossary_fts(rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES (new.id, new.term, new.short_definition, new.long_definition, new.abbreviation, new.alternate_names);
END;
