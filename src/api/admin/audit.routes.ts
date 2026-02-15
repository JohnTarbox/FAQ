import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { AuditService } from '../../services/audit.service';
import { requireRole } from '../../middleware/auth';

export const adminAuditRoutes = new Hono<AppEnv>();

// GET /api/admin/audit — list global audit log (reviewer+ only)
adminAuditRoutes.get('/', requireRole('reviewer'), async (c) => {
  const svc = new AuditService(c.env.DB);

  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 50;
  const actorEmail = c.req.query('actorEmail');
  const action = c.req.query('action');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  const result = await svc.listAll({ page, limit, actorEmail, action, startDate, endDate });
  return c.json(result);
});
