CREATE TABLE IF NOT EXISTS faq_known_sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO faq_known_sites (url, title) VALUES
  ('http://www.aprs.org', 'APRS.org'),
  ('https://aprs.fi', 'aprs.fi'),
  ('https://www.arrl.org/aprs-mode', 'ARRL APRS Mode'),
  ('https://aprsdirect.com/views/about.php', 'APRS Direct About');
