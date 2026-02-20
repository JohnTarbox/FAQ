-- AI-powered FAQ suggestion system tables

-- Search terms that drive content discovery
CREATE TABLE IF NOT EXISTS faq_search_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_types TEXT NOT NULL DEFAULT '["web","youtube","site"]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default APRS search terms
INSERT OR IGNORE INTO faq_search_terms (term) VALUES
  ('APRS tutorial'),
  ('APRS setup guide'),
  ('APRS digipeater'),
  ('APRS iGate'),
  ('APRS weather station'),
  ('APRS-IS network'),
  ('Direwolf APRS'),
  ('APRS mobile'),
  ('APRS beacon'),
  ('APRS messaging');

-- Tracks processed URLs to avoid re-processing
CREATE TABLE IF NOT EXISTS faq_discovery_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  title TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  suggestions_generated INTEGER NOT NULL DEFAULT 0,
  batch_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_discovery_sources_url ON faq_discovery_sources(url);
CREATE INDEX IF NOT EXISTS idx_discovery_sources_batch ON faq_discovery_sources(batch_id);

-- Audit trail for each discovery execution
CREATE TABLE IF NOT EXISTS faq_discovery_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'running',
  triggered_by TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  sources_checked INTEGER NOT NULL DEFAULT 0,
  suggestions_created INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  batch_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_status ON faq_discovery_runs(status);

-- AI-generated FAQ suggestions
CREATE TABLE IF NOT EXISTS faq_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  source_type TEXT NOT NULL,
  source_snippet TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 50,
  suggested_category TEXT,
  suggested_tags TEXT,
  search_keywords TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  reviewed_by TEXT,
  review_note TEXT,
  accepted_faq_entry_id INTEGER REFERENCES faq_entries(id) ON DELETE SET NULL,
  batch_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON faq_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_batch ON faq_suggestions(batch_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_source_type ON faq_suggestions(source_type);
