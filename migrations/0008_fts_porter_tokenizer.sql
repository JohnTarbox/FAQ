-- Migration: 0008_fts_porter_tokenizer
-- Add Porter stemming to FTS5 tables so inflectional variants match
-- (e.g., "frequency" matches "frequencies", "station" matches "stations")

-- ============================================================
-- Drop existing FTS triggers (must happen before dropping tables)
-- ============================================================
DROP TRIGGER IF EXISTS faq_versions_ai;
DROP TRIGGER IF EXISTS faq_versions_ad;
DROP TRIGGER IF EXISTS faq_versions_au;
DROP TRIGGER IF EXISTS glossary_terms_ai;
DROP TRIGGER IF EXISTS glossary_terms_ad;
DROP TRIGGER IF EXISTS glossary_terms_au;

-- ============================================================
-- Drop existing FTS tables
-- ============================================================
DROP TABLE IF EXISTS faq_fts;
DROP TABLE IF EXISTS glossary_fts;

-- ============================================================
-- Recreate FTS tables with Porter stemming tokenizer
-- ============================================================
CREATE VIRTUAL TABLE faq_fts USING fts5(
  question,
  answer,
  search_keywords,
  content='faq_versions',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE glossary_fts USING fts5(
  term,
  short_definition,
  long_definition,
  abbreviation,
  alternate_names,
  content='glossary_terms',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- ============================================================
-- Rebuild indexes from existing content
-- ============================================================
INSERT INTO faq_fts(faq_fts) VALUES('rebuild');
INSERT INTO glossary_fts(glossary_fts) VALUES('rebuild');

-- ============================================================
-- Recreate FTS sync triggers
-- ============================================================
CREATE TRIGGER faq_versions_ai AFTER INSERT ON faq_versions BEGIN
  INSERT INTO faq_fts(rowid, question, answer, search_keywords)
  VALUES (new.id, new.question, new.answer, new.search_keywords);
END;

CREATE TRIGGER faq_versions_ad AFTER DELETE ON faq_versions BEGIN
  INSERT INTO faq_fts(faq_fts, rowid, question, answer, search_keywords)
  VALUES ('delete', old.id, old.question, old.answer, old.search_keywords);
END;

CREATE TRIGGER faq_versions_au AFTER UPDATE ON faq_versions BEGIN
  INSERT INTO faq_fts(faq_fts, rowid, question, answer, search_keywords)
  VALUES ('delete', old.id, old.question, old.answer, old.search_keywords);
  INSERT INTO faq_fts(rowid, question, answer, search_keywords)
  VALUES (new.id, new.question, new.answer, new.search_keywords);
END;

CREATE TRIGGER glossary_terms_ai AFTER INSERT ON glossary_terms BEGIN
  INSERT INTO glossary_fts(rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES (new.id, new.term, new.short_definition, new.long_definition, new.abbreviation, new.alternate_names);
END;

CREATE TRIGGER glossary_terms_ad AFTER DELETE ON glossary_terms BEGIN
  INSERT INTO glossary_fts(glossary_fts, rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES ('delete', old.id, old.term, old.short_definition, old.long_definition, old.abbreviation, old.alternate_names);
END;

CREATE TRIGGER glossary_terms_au AFTER UPDATE ON glossary_terms BEGIN
  INSERT INTO glossary_fts(glossary_fts, rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES ('delete', old.id, old.term, old.short_definition, old.long_definition, old.abbreviation, old.alternate_names);
  INSERT INTO glossary_fts(rowid, term, short_definition, long_definition, abbreviation, alternate_names)
  VALUES (new.id, new.term, new.short_definition, new.long_definition, new.abbreviation, new.alternate_names);
END;
