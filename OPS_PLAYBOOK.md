# FAQ Project — Operations Playbook

Production queries and audit workflows for the FAQ CMS running on Cloudflare Workers + D1 + KV + R2.

These can be run via `wrangler d1 execute` CLI or via the Cloudflare MCP server (`https://mcp.cloudflare.com/mcp`) configured in `.mcp.json`.

---

## Resource IDs

| Resource | Binding | ID |
|----------|---------|-----|
| D1 Database | `DB` | `faq-glossary-db` / `6069ca96-833e-4115-85b8-4c53dc106469` |
| KV Namespace | `CACHE` | `294f05e62ae84ef4a54b085ed0b6a2bb` |
| R2 Bucket | `IMAGES` | `faq-glossary-images` |
| Worker | — | `faq-glossary` at `faq.aprs.works` |

---

## 1. Discovery Pipeline Health Check

### Check for stuck runs
```sql
SELECT id, status, triggered_by, trigger_type, sources_checked,
       suggestions_created, started_at, completed_at
FROM faq_discovery_runs
WHERE status = 'running'
```

### Recent run history
```sql
SELECT id, status, triggered_by, trigger_type, sources_checked,
       suggestions_created, started_at, completed_at
FROM faq_discovery_runs
ORDER BY id DESC LIMIT 10
```

### Fix a stuck run (manually mark as failed)
```sql
UPDATE faq_discovery_runs
SET status = 'failed', completed_at = datetime('now'),
    errors = '["Manually marked as failed via ops playbook"]'
WHERE id = <RUN_ID> AND status = 'running'
```

### Suggestion acceptance rates
```sql
SELECT status, COUNT(*) as count
FROM faq_suggestions
GROUP BY status
```

### Suggestions by source type and status
```sql
SELECT source_type, status, COUNT(*) as count
FROM faq_suggestions
GROUP BY source_type, status
ORDER BY source_type, status
```

### Suggestion confidence distribution
```sql
SELECT
  CASE
    WHEN confidence_score >= 80 THEN 'high (80-100)'
    WHEN confidence_score >= 60 THEN 'medium (60-79)'
    WHEN confidence_score >= 40 THEN 'low (40-59)'
    ELSE 'very low (<40)'
  END as confidence_band,
  COUNT(*) as count
FROM faq_suggestions
GROUP BY confidence_band
ORDER BY confidence_band
```

### Discovery source stats
```sql
SELECT COUNT(*) as total_sources, MAX(fetched_at) as latest_fetch
FROM faq_discovery_sources
```

---

## 2. Content Health

### FAQ versions by status
```sql
SELECT status, COUNT(*) as count
FROM faq_versions
GROUP BY status
ORDER BY count DESC
```

### FAQs with no published version (unpublished/languishing)
```sql
SELECT e.id, e.slug, e.created_at
FROM faq_entries e
WHERE e.live_version_id IS NULL
```

### Versions per FAQ (most revised)
```sql
SELECT e.id, e.slug, COUNT(v.id) as version_count
FROM faq_entries e
LEFT JOIN faq_versions v ON e.id = v.entry_id
GROUP BY e.id
ORDER BY version_count DESC
```

### FAQ category distribution
```sql
SELECT c.name, COUNT(e.id) as faq_count
FROM faq_categories c
LEFT JOIN faq_entries e ON c.id = e.category_id
GROUP BY c.id, c.name
ORDER BY faq_count DESC
```

### Uncategorized FAQs
```sql
SELECT id, slug FROM faq_entries WHERE category_id IS NULL
```

### Glossary terms by status
```sql
SELECT status, COUNT(*) as count
FROM glossary_terms
GROUP BY status
```

### Glossary terms missing long definitions
```sql
SELECT id, term, slug
FROM glossary_terms
WHERE long_definition IS NULL OR length(long_definition) < 20
```

### Search terms configuration
```sql
SELECT term, is_active, source_types
FROM faq_search_terms
ORDER BY is_active DESC, term
```

### Known sites configuration
```sql
SELECT url, title, is_active
FROM faq_known_sites
ORDER BY is_active DESC, url
```

---

## 3. Search Quality Validation

### FTS index row counts
```sql
SELECT 'faq_fts' as idx, COUNT(*) as rows FROM faq_fts
UNION ALL
SELECT 'glossary_fts', COUNT(*) FROM glossary_fts
```

### Test FAQ search (prefix matching)
```sql
-- Replace TERM with search term
SELECT faq_fts.rowid, question, rank
FROM faq_fts
WHERE faq_fts MATCH '"TERM"*'
ORDER BY rank
LIMIT 10
```

### Test glossary search
```sql
SELECT glossary_fts.rowid, term, rank
FROM glossary_fts
WHERE glossary_fts MATCH '"TERM"*'
ORDER BY rank
LIMIT 10
```

### FAQs with empty search_keywords (potential FTS gaps)
```sql
SELECT fv.id, fv.question, fe.slug
FROM faq_versions fv
JOIN faq_entries fe ON fe.id = fv.entry_id AND fe.live_version_id = fv.id
WHERE fv.search_keywords IS NULL OR fv.search_keywords = ''
```

> **Tokenizer**: FTS5 uses `tokenize='porter unicode61'` (added in migration 0008).
> The Porter stemmer handles English inflectional variants (e.g., "frequency"
> matches "frequencies", "station" matches "stations") automatically.

---

## 4. KV Cache Audit

### List all cache keys (via wrangler CLI)
```bash
npx wrangler kv key list --namespace-id=294f05e62ae84ef4a54b085ed0b6a2bb --remote
```

### Read a specific cache value
```bash
npx wrangler kv key get --namespace-id=294f05e62ae84ef4a54b085ed0b6a2bb "KEY_NAME" --remote
```

### Delete a specific cache key
```bash
npx wrangler kv key delete --namespace-id=294f05e62ae84ef4a54b085ed0b6a2bb "KEY_NAME" --remote
```

### Expected key patterns
| Pattern | Description |
|---------|-------------|
| `faq-glossary:faq:list:{page}:{category}` | Paginated FAQ list cache |
| `faq-glossary:faq:detail:{slug}` | Individual FAQ detail cache |
| `faq-glossary:glossary:all` | Full glossary listing cache |
| `faq-glossary:glossary:detail:{slug}` | Individual glossary term cache |
| `faq-glossary:glossary:terms-index` | Terms index for tooltip widget |
| `session:{hash}` | Okta OIDC session (TTL'd) |

---

## 5. R2 Image Audit

### List images via admin API
```
GET https://faq.aprs.works/api/admin/images?folder=images/
```

### Cross-reference with content (find image URLs in D1)
```sql
-- Check FAQ answers for image references
SELECT fv.id, fe.slug
FROM faq_versions fv
JOIN faq_entries fe ON fe.id = fv.entry_id
WHERE fv.answer LIKE '%/images/%'

-- Check glossary definitions for image references
SELECT id, term
FROM glossary_terms
WHERE long_definition LIKE '%/images/%'
```

Any R2 objects NOT referenced in the above queries are orphans and can be safely deleted.

---

## 6. Schema Drift Check

### List all production tables
```sql
SELECT name, type FROM sqlite_master
WHERE type IN ('table', 'view')
ORDER BY name
```

### Compare with Drizzle schema
The Drizzle schema is at `src/db/schema.ts`. Key tables:
- `faq_categories`, `faq_tags`, `faq_entries`, `faq_versions`, `faq_entry_tags`
- `glossary_categories`, `glossary_terms`, `term_relationships`
- `faq_audit_log`, `notifications`
- `faq_known_sites`, `faq_search_terms`, `faq_discovery_sources`
- `faq_discovery_runs`, `faq_suggestions`
- FTS5: `faq_fts`, `glossary_fts`

---

## Baseline Snapshot (2026-02-23)

| Metric | Value |
|--------|-------|
| FAQ entries | 25 |
| FAQ versions (published) | 20 |
| FAQ versions (draft) | 5 |
| FAQ versions (pending review) | 3 |
| Unpublished FAQ entries | 5 |
| FAQ categories | 0 (none created) |
| Glossary terms (published) | 12 |
| Discovery runs (total) | 14 |
| Discovery runs (failed) | 2 |
| Suggestions (total) | 52 |
| Suggestions (accepted) | 23 (44%) |
| Suggestions (dismissed) | 11 (21%) |
| Suggestions (new/pending) | 18 (35%) |
| Suggestion sources | All `site` type |
| Confidence high (80+) | 48 (92%) |
| KV cache keys | 2 |
| Search terms (active) | 10 |
| FTS5 tokenizer | `porter unicode61` (English stemming) |
| DB size | ~356 KB |
