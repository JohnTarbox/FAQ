import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { SuggestionService } from '../../services/suggestion.service';
import { DiscoveryService } from '../../services/discovery.service';
import { requireRole } from '../../middleware/auth';
import type { SuggestionStatus } from '../../db/schema';

export const adminSuggestionRoutes = new Hono<AppEnv>();

// GET /api/admin/suggestions — list suggestions
adminSuggestionRoutes.get('/', async (c) => {
  const svc = new SuggestionService(c.env.DB);
  const status = c.req.query('status') as SuggestionStatus | undefined;
  const sourceType = c.req.query('source_type');
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;

  const result = await svc.list({ status, sourceType: sourceType || undefined, page, limit });
  return c.json(result);
});

// GET /api/admin/suggestions/stats — suggestion counts by status
adminSuggestionRoutes.get('/stats', async (c) => {
  const svc = new SuggestionService(c.env.DB);
  const stats = await svc.getStats();
  return c.json(stats);
});

// GET /api/admin/suggestions/runs — discovery run history
adminSuggestionRoutes.get('/runs', requireRole('admin'), async (c) => {
  const svc = new SuggestionService(c.env.DB);
  const runs = await svc.listRuns();
  return c.json(runs);
});

// GET /api/admin/suggestions/runs/:id — single run with parsed log
adminSuggestionRoutes.get('/runs/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new SuggestionService(c.env.DB);
  const run = await svc.getRun(id);
  if (!run) return c.json({ error: 'Run not found' }, 404);

  return c.json({
    ...run,
    log: run.log ? JSON.parse(run.log) : [],
  });
});

// GET /api/admin/suggestions/search-terms — list search terms
adminSuggestionRoutes.get('/search-terms', requireRole('admin'), async (c) => {
  const svc = new SuggestionService(c.env.DB);
  const terms = await svc.listSearchTerms();
  return c.json(terms);
});

// POST /api/admin/suggestions/search-terms — add search term
adminSuggestionRoutes.post('/search-terms', requireRole('admin'), async (c) => {
  const body = await c.req.json();
  if (!body.term) return c.json({ error: 'term is required' }, 400);

  const svc = new SuggestionService(c.env.DB);

  try {
    const term = await svc.addSearchTerm(body.term, body.sourceTypes);
    return c.json(term, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// PUT /api/admin/suggestions/search-terms/:id — update search term
adminSuggestionRoutes.put('/search-terms/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const svc = new SuggestionService(c.env.DB);

  await svc.updateSearchTerm(id, {
    term: body.term,
    isActive: body.isActive,
    sourceTypes: body.sourceTypes,
  });
  return c.json({ success: true });
});

// DELETE /api/admin/suggestions/search-terms/:id — delete search term
adminSuggestionRoutes.delete('/search-terms/:id', requireRole('admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new SuggestionService(c.env.DB);
  await svc.deleteSearchTerm(id);
  return c.json({ success: true });
});

// GET /api/admin/suggestions/:id — single suggestion detail
adminSuggestionRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new SuggestionService(c.env.DB);
  const suggestion = await svc.getById(id);
  if (!suggestion) return c.json({ error: 'Suggestion not found' }, 404);
  return c.json(suggestion);
});

// POST /api/admin/suggestions/:id/accept — accept suggestion
adminSuggestionRoutes.post('/:id/accept', requireRole('reviewer'), async (c) => {
  const id = Number(c.req.param('id'));
  const reviewerEmail = c.get('userEmail');
  const body = await c.req.json().catch(() => ({}));

  const svc = new SuggestionService(c.env.DB);

  try {
    const result = await svc.accept(id, reviewerEmail, {
      question: body.question,
      answer: body.answer,
    });
    return c.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// POST /api/admin/suggestions/:id/dismiss — dismiss suggestion
adminSuggestionRoutes.post('/:id/dismiss', requireRole('reviewer'), async (c) => {
  const id = Number(c.req.param('id'));
  const reviewerEmail = c.get('userEmail');
  const body = await c.req.json().catch(() => ({}));

  const svc = new SuggestionService(c.env.DB);

  try {
    const result = await svc.dismiss(id, reviewerEmail, body.reason);
    return c.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// POST /api/admin/suggestions/bulk-dismiss — batch dismiss
adminSuggestionRoutes.post('/bulk-dismiss', requireRole('reviewer'), async (c) => {
  const body = await c.req.json();
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return c.json({ error: 'ids array is required' }, 400);
  }

  const reviewerEmail = c.get('userEmail');
  const svc = new SuggestionService(c.env.DB);
  const results = await svc.bulkDismiss(body.ids, reviewerEmail, body.reason);
  return c.json(results);
});

// POST /api/admin/suggestions/discover — manual trigger (non-blocking)
adminSuggestionRoutes.post('/discover', requireRole('admin'), async (c) => {
  const userEmail = c.get('userEmail');
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Create run record synchronously so we can return its ID
  const svc = new SuggestionService(c.env.DB);
  const run = await svc.createRun(userEmail, 'manual', batchId);

  // Run discovery in the background via waitUntil
  const discovery = new DiscoveryService(c.env);
  c.executionCtx.waitUntil(
    discovery.runDiscovery(userEmail, 'manual', { id: run.id }, batchId)
  );

  return c.json({ id: run.id, status: 'running' });
});
