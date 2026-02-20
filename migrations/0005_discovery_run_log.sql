-- Add log column to faq_discovery_runs for streaming status entries
ALTER TABLE faq_discovery_runs ADD COLUMN log TEXT;
