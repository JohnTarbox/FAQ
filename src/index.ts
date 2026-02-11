import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './env';
import { faqRoutes } from './api/faq.routes';
import { glossaryRoutes } from './api/glossary.routes';
import { adminFaqRoutes } from './api/admin/faq.routes';
import { adminGlossaryRoutes } from './api/admin/glossary.routes';
import { adminCategoryRoutes } from './api/admin/categories.routes';
import { adminTagRoutes } from './api/admin/tags.routes';
import { adminImportRoutes } from './api/admin/import.routes';
import { adminImageRoutes } from './api/admin/images.routes';
import { authMiddleware } from './middleware/auth';
import { pageRoutes } from './pages/routes';

export type AppEnv = { Bindings: Env; Variables: { userEmail: string; userRole: string } };

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('/api/*', cors());

// Public page routes (server-rendered HTML)
app.route('/', pageRoutes);

// Public API routes
app.route('/api/faq', faqRoutes);
app.route('/api/glossary', glossaryRoutes);

// Admin API routes (auth required)
app.use('/api/admin/*', authMiddleware);
app.route('/api/admin/faq', adminFaqRoutes);
app.route('/api/admin/glossary', adminGlossaryRoutes);
app.route('/api/admin/categories', adminCategoryRoutes);
app.route('/api/admin/tags', adminTagRoutes);
app.route('/api/admin/import', adminImportRoutes);
app.route('/api/admin/images', adminImageRoutes);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public image serving from R2
app.get('/images/*', async (c) => {
  const key = c.req.path.slice(1); // strip leading slash → "images/..."
  const object = await c.env.IMAGES.get(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
});

// Admin SPA fallback — static assets are served automatically by Workers Assets
// for files that exist on disk. Client-side routes fall through to the Worker.
app.get('/admin', (c) => c.redirect('/admin/'));
app.get('/admin/*', async (c) => {
  const assetUrl = new URL('/admin/index.html', c.req.url);
  return c.env.ASSETS.fetch(assetUrl);
});

export default app;
