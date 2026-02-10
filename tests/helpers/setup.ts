import { env } from 'cloudflare:test';

// Inline migration SQL (Workers runtime cannot use fs.readFileSync)
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS faq_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faq_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS faq_entry_tags (
  entry_id INTEGER NOT NULL REFERENCES faq_entries(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES faq_tags(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_faq_entry_tags_unique ON faq_entry_tags(entry_id, tag_id);

CREATE TABLE IF NOT EXISTS glossary_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS term_relationships (
  term_id INTEGER NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE,
  related_term_id INTEGER NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_term_relationships_unique ON term_relationships(term_id, related_term_id);

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

CREATE VIRTUAL TABLE IF NOT EXISTS faq_fts USING fts5(
  question, answer, search_keywords,
  content='faq_versions', content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS glossary_fts USING fts5(
  term, short_definition, long_definition, abbreviation, alternate_names,
  content='glossary_terms', content_rowid='id'
);

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
`;

/**
 * Split SQL respecting BEGIN...END blocks (for triggers).
 * Semicolons inside trigger bodies should not split.
 */
function splitSql(sql: string): string[] {
  const results: string[] = [];
  let current = '';
  let inTrigger = false;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.length === 0) continue;

    if (/\bBEGIN\b/i.test(trimmed)) inTrigger = true;

    current += line + '\n';

    if (inTrigger && /\bEND\b/i.test(trimmed)) {
      inTrigger = false;
      results.push(current.trim().replace(/;$/, ''));
      current = '';
    } else if (!inTrigger && trimmed.endsWith(';')) {
      results.push(current.trim().replace(/;$/, ''));
      current = '';
    }
  }

  if (current.trim()) results.push(current.trim().replace(/;$/, ''));
  return results.filter(s => s.length > 0);
}

export async function runMigrations() {
  const statements = splitSql(MIGRATION_SQL);

  for (const stmt of statements) {
    await env.DB.prepare(stmt).run();
  }
}

export async function seedFaqData() {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO faq_categories (name, slug, sort_order) VALUES ('Tickets & Pricing', 'tickets-pricing', 1)"
  ).run();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO faq_tags (name, slug) VALUES ('Hours', 'hours')"
  ).run();
}

export async function seedGlossaryData() {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO glossary_categories (name, slug) VALUES ('Youth Programs', 'youth-programs')"
  ).run();
}
