export class SearchService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async searchFaq(query: string, limit = 20, offset = 0) {
    const ftsQuery = this.sanitizeFtsQuery(query);

    const results = await this.db.prepare(`
      SELECT
        fv.id as version_id,
        fv.entry_id,
        fv.question,
        substr(fv.answer, 1, 200) as answer_preview,
        fe.slug,
        fe.category_id,
        fe.is_featured,
        rank
      FROM faq_fts
      JOIN faq_versions fv ON fv.id = faq_fts.rowid
      JOIN faq_entries fe ON fe.id = fv.entry_id AND fe.live_version_id = fv.id
      WHERE faq_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).bind(ftsQuery, limit, offset).all();

    return results.results || [];
  }

  async searchGlossary(query: string, limit = 20, offset = 0) {
    const ftsQuery = this.sanitizeFtsQuery(query);

    const results = await this.db.prepare(`
      SELECT
        gt.id,
        gt.term,
        gt.slug,
        gt.short_definition,
        gt.abbreviation,
        rank
      FROM glossary_fts
      JOIN glossary_terms gt ON gt.id = glossary_fts.rowid
      WHERE gt.status = 'published'
        AND glossary_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).bind(ftsQuery, limit, offset).all();

    return results.results || [];
  }

  private sanitizeFtsQuery(query: string): string {
    // Escape special FTS5 characters and wrap terms for prefix matching
    return query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 0)
      .map(t => `"${t}"*`)
      .join(' ');
  }
}
