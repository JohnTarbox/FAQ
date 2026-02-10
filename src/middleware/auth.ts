import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../index';

export type UserRole = 'admin' | 'reviewer' | 'author';

interface CfAccessJwtPayload {
  email: string;
  sub: string;
  iss: string;
  iat: number;
  exp: number;
  custom?: {
    groups?: string[];
  };
}

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

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // In development, allow a mock auth header
  if (c.env.ENVIRONMENT === 'development') {
    const mockEmail = c.req.header('X-Mock-User-Email');
    const mockRole = c.req.header('X-Mock-User-Role') as UserRole | undefined;
    if (mockEmail) {
      c.set('userEmail', mockEmail);
      c.set('userRole', mockRole || 'author');
      return next();
    }
  }

  // Cloudflare Access sets Cf-Access-Jwt-Assertion header
  const jwtToken = c.req.header('Cf-Access-Jwt-Assertion');
  if (!jwtToken) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const payload = parseJwt(jwtToken);

    if (!payload.email) {
      return c.json({ error: 'Invalid token: missing email' }, 401);
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Token expired' }, 401);
    }

    const groups = payload.custom?.groups || [];
    const role = resolveRole(groups);

    c.set('userEmail', payload.email);
    c.set('userRole', role);

    return next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
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

function parseJwt(token: string): CfAccessJwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}
