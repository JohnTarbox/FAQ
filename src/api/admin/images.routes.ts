import { Hono } from 'hono';
import type { AppEnv } from '../../index';
import { ImageService } from '../../services/image.service';

export const adminImageRoutes = new Hono<AppEnv>();

// POST /api/admin/images/upload
adminImageRoutes.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'faq';

  if (!file) return c.json({ error: 'No file provided' }, 400);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, SVG' }, 400);
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return c.json({ error: 'File too large. Maximum: 10MB' }, 400);
  }

  const svc = new ImageService(c.env.IMAGES);
  const validFolder = folder === 'glossary' ? 'glossary' : 'faq';
  const path = ImageService.generatePath(file.name, validFolder);
  const url = await svc.upload(file, path, file.type);

  return c.json({ url, path, contentType: file.type, size: file.size }, 201);
});

// GET /api/admin/images — list uploaded images
adminImageRoutes.get('/', async (c) => {
  const svc = new ImageService(c.env.IMAGES);
  const folder = c.req.query('folder') || 'images/';
  const cursor = c.req.query('cursor');
  const result = await svc.list(folder, 50, cursor);
  return c.json(result);
});

// DELETE /api/admin/images/:key — delete image
adminImageRoutes.delete('/*', async (c) => {
  const key = c.req.path.replace('/api/admin/images/', '');
  if (!key) return c.json({ error: 'Image key is required' }, 400);

  const svc = new ImageService(c.env.IMAGES);
  await svc.delete(key);
  return c.json({ success: true });
});
