import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../index';
import { getSession } from '../services/session.service';

export type UserRole = 'admin' | 'reviewer' | 'author';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  reviewer: 2,
  author: 1,
};

export function resolveRole(groups: string[]): UserRole {
  if (groups.includes('CMS-Admins')) return 'admin';
  if (groups.includes('CMS-Reviewers')) return 'reviewer';
  return 'author';
}

export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

function getSessionIdFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/);
  return match ? match[1] : null;
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // In development, allow mock auth headers
  if (c.env.ENVIRONMENT === 'development') {
    const mockEmail = c.req.header('X-Mock-User-Email');
    const mockRole = c.req.header('X-Mock-User-Role') as UserRole | undefined;
    if (mockEmail) {
      c.set('userEmail', mockEmail);
      c.set('userRole', mockRole || 'author');
      return next();
    }
  }

  // Read session from cookie
  const sessionId = getSessionIdFromCookie(c.req.header('Cookie'));
  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const session = await getSession(c.env.CACHE, sessionId);
  if (!session) {
    return c.json({ error: 'Session expired' }, 401);
  }

  c.set('userEmail', session.email);
  c.set('userRole', session.role);

  return next();
});

export function requireRole(minRole: UserRole) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const userRole = c.get('userRole') as UserRole;
    if (!hasMinRole(userRole, minRole)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    return next();
  });
}
