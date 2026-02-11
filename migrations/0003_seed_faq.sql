-- Seed FAQ: Who created APRS?
INSERT INTO faq_entries (slug, created_by)
VALUES ('who-created-aprs', 'seed@aprs.works');

INSERT INTO faq_versions (entry_id, version_number, question, answer, status, author_email, published_at)
VALUES (
  (SELECT id FROM faq_entries WHERE slug = 'who-created-aprs'),
  1,
  'Who created APRS?',
  '<p>APRS was created by <strong>Bob Bruninga</strong> (call sign WB4APR), a senior research engineer at the United States Naval Academy. Bruninga developed the system over several decades, starting with early ancestors:</p><ul><li><strong>1982:</strong> Created a data map program on an Apple II to plot the positions of US Navy ships.</li><li><strong>1984:</strong> Developed a more advanced version on a VIC-20 for reporting the status and position of horses in an endurance run.</li><li><strong>Late 1980s:</strong> Refined the system into the Connectionless Emergency Traffic System (CETS), which was used in FEMA exercises.</li><li><strong>1992:</strong> Officially renamed the protocol to APRS (Automatic Position Reporting System), later changing "Position" to "Packet" to reflect its broader capabilities.</li></ul><p>Bruninga remained the lead developer and primary authority on the protocol until his death in February 2022. His legacy continues through the APRS Foundation, established to preserve and advance the protocol.</p>',
  'published',
  'seed@aprs.works',
  datetime('now')
);

UPDATE faq_entries
SET live_version_id = (
  SELECT id FROM faq_versions
  WHERE entry_id = (SELECT id FROM faq_entries WHERE slug = 'who-created-aprs')
  LIMIT 1
)
WHERE slug = 'who-created-aprs';
