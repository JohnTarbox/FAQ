import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { NotificationService } from '../../services/notification.service';

export const adminNotificationRoutes = new Hono<AppEnv>();

// GET /api/admin/notifications — list notifications for current user
adminNotificationRoutes.get('/', async (c) => {
  const email = c.get('userEmail');
  const unreadOnly = c.req.query('unreadOnly') === 'true';
  const svc = new NotificationService(c.env.DB);
  const items = await svc.listForUser(email, unreadOnly);
  return c.json({ items });
});

// GET /api/admin/notifications/unread-count — unread count for current user
adminNotificationRoutes.get('/unread-count', async (c) => {
  const email = c.get('userEmail');
  const svc = new NotificationService(c.env.DB);
  const count = await svc.getUnreadCount(email);
  return c.json({ count });
});

// POST /api/admin/notifications/:id/read — mark single notification read
adminNotificationRoutes.post('/:id/read', async (c) => {
  const email = c.get('userEmail');
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  const svc = new NotificationService(c.env.DB);
  await svc.markAsRead(id, email);
  return c.json({ success: true });
});

// POST /api/admin/notifications/read-all — mark all notifications read
adminNotificationRoutes.post('/read-all', async (c) => {
  const email = c.get('userEmail');
  const svc = new NotificationService(c.env.DB);
  await svc.markAllAsRead(email);
  return c.json({ success: true });
});
