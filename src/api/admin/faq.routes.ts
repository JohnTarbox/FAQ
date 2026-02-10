import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { FaqService } from '../../services/faq.service';
import { CacheService } from '../../services/cache.service';
import { NotificationService } from '../../services/notification.service';
import { requireRole } from '../../middleware/auth';

export const adminFaqRoutes = new Hono<AppEnv>();

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/faq — list all FAQs (any status)
adminFaqRoutes.get('/', async (c) => {
  const svc = new FaqService(c.env.DB);
  const status = c.req.query('status') as 'draft' | 'pending_review' | 'published' | 'rejected' | undefined;
  const categoryId = c.req.query('categoryId') ? Number(c.req.query('categoryId')) : undefined;
  const page = Number(c.req.query('page')) || 1;
  const search = c.req.query('search');

  const result = await svc.listAll({ status, categoryId, page, search });
  return c.json(result);
});

// GET /api/admin/faq/:id — get full FAQ with all versions
adminFaqRoutes.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new FaqService(c.env.DB);

  const entry = await svc.getById(id);
  if (!entry) return c.json({ error: 'FAQ not found' }, 404);

  const versions = await svc.getVersions(id);
  const latestVersion = versions[0] || null;

  return c.json({ ...entry, versions, latestVersion });
});

// POST /api/admin/faq — create new FAQ
adminFaqRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const userEmail = c.get('userEmail');

  if (!body.question || !body.answer) {
    return c.json({ error: 'question and answer are required' }, 400);
  }

  const svc = new FaqService(c.env.DB);
  const slug = body.slug || slugify(body.question);

  const result = await svc.create({
    question: body.question,
    answer: body.answer,
    slug,
    categoryId: body.categoryId,
    searchKeywords: body.searchKeywords,
    authorEmail: userEmail,
  });

  if (body.tagIds) {
    await svc.setTags(result.entry.id, body.tagIds);
  }

  return c.json(result, 201);
});

// PUT /api/admin/faq/:id — update FAQ entry metadata
adminFaqRoutes.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const svc = new FaqService(c.env.DB);

  const entry = await svc.getById(id);
  if (!entry) return c.json({ error: 'FAQ not found' }, 404);

  await svc.updateEntry(id, {
    categoryId: body.categoryId,
    isFeatured: body.isFeatured,
    sortOrder: body.sortOrder,
    slug: body.slug,
  });

  if (body.tagIds) {
    await svc.setTags(id, body.tagIds);
  }

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateFaq();

  return c.json({ success: true });
});

// POST /api/admin/faq/:id/version — create new version for existing FAQ
adminFaqRoutes.post('/:id/version', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const userEmail = c.get('userEmail');

  const svc = new FaqService(c.env.DB);
  const entry = await svc.getById(id);
  if (!entry) return c.json({ error: 'FAQ not found' }, 404);

  const version = await svc.createNewVersion(id, {
    question: body.question,
    answer: body.answer,
    searchKeywords: body.searchKeywords,
    authorEmail: userEmail,
  });

  return c.json(version, 201);
});

// POST /api/admin/faq/version/:versionId/submit — submit for review
adminFaqRoutes.post('/version/:versionId/submit', async (c) => {
  const versionId = Number(c.req.param('versionId'));
  const userEmail = c.get('userEmail');

  const svc = new FaqService(c.env.DB);

  try {
    const result = await svc.submitForReview(versionId, userEmail);

    // Notify reviewers
    const notif = new NotificationService(c.env.DB, c.env.RESEND_API_KEY);
    await notif.create({
      recipientEmail: 'reviewers@fair.example.com', // In production, query all reviewers
      type: 'review_requested',
      title: 'New FAQ submitted for review',
      body: `${userEmail} submitted an FAQ for review.`,
      linkUrl: `/admin/faq/${result.entryId}`,
    });

    return c.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// POST /api/admin/faq/version/:versionId/approve — approve version
adminFaqRoutes.post('/version/:versionId/approve', requireRole('reviewer'), async (c) => {
  const versionId = Number(c.req.param('versionId'));
  const reviewerEmail = c.get('userEmail');

  const svc = new FaqService(c.env.DB);

  try {
    const result = await svc.approve(versionId, reviewerEmail);

    const cache = new CacheService(c.env.CACHE);
    await cache.invalidateFaq();

    const notif = new NotificationService(c.env.DB, c.env.RESEND_API_KEY);
    await notif.create({
      recipientEmail: result.authorEmail,
      type: 'approved',
      title: 'Your FAQ has been approved',
      body: `Your FAQ was approved by ${reviewerEmail} and is now published.`,
      linkUrl: `/admin/faq/${result.entryId}`,
    });

    return c.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// POST /api/admin/faq/version/:versionId/reject — reject version
adminFaqRoutes.post('/version/:versionId/reject', requireRole('reviewer'), async (c) => {
  const versionId = Number(c.req.param('versionId'));
  const body = await c.req.json();
  const reviewerEmail = c.get('userEmail');

  if (!body.note) return c.json({ error: 'Rejection note is required' }, 400);

  const svc = new FaqService(c.env.DB);

  try {
    const result = await svc.reject(versionId, reviewerEmail, body.note);

    const notif = new NotificationService(c.env.DB, c.env.RESEND_API_KEY);
    await notif.create({
      recipientEmail: result.authorEmail,
      type: 'rejected',
      title: 'Your FAQ was not approved',
      body: `Your FAQ was rejected by ${reviewerEmail}. Note: ${body.note}`,
      linkUrl: `/admin/faq/${result.entryId}`,
    });

    return c.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return c.json({ error: msg }, 400);
  }
});

// DELETE /api/admin/faq/:id
adminFaqRoutes.delete('/:id', requireRole('reviewer'), async (c) => {
  const id = Number(c.req.param('id'));
  const userEmail = c.get('userEmail');
  const svc = new FaqService(c.env.DB);

  const entry = await svc.getById(id);
  if (!entry) return c.json({ error: 'FAQ not found' }, 404);

  await svc.deleteEntry(id, userEmail);

  const cache = new CacheService(c.env.CACHE);
  await cache.invalidateFaq();

  return c.json({ success: true });
});

// GET /api/admin/faq/:id/audit — get audit log
adminFaqRoutes.get('/:id/audit', async (c) => {
  const id = Number(c.req.param('id'));
  const svc = new FaqService(c.env.DB);
  const log = await svc.getAuditLog(id);
  return c.json(log);
});
