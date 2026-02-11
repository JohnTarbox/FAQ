import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { getAuthorizationUrl, handleCallback, getLogoutUrl, type OktaConfig } from '../services/okta.service';
import { verifyIdToken } from '../services/jwks.service';
import { createSession, getSession, deleteSession } from '../services/session.service';
import { resolveRole } from '../middleware/auth';

export const authRoutes = new Hono<AppEnv>();

function getOktaConfig(env: { OKTA_DOMAIN: string; OKTA_CLIENT_ID: string; OKTA_CLIENT_SECRET: string }, reqUrl: string): OktaConfig {
  const url = new URL(reqUrl);
  return {
    domain: env.OKTA_DOMAIN,
    clientId: env.OKTA_CLIENT_ID,
    clientSecret: env.OKTA_CLIENT_SECRET,
    redirectUri: `${url.origin}/auth/callback`,
  };
}

function getSessionIdFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/);
  return match ? match[1] : null;
}

function sessionCookie(sessionId: string, env: string): string {
  const secure = env !== 'development' ? '; Secure' : '';
  return `session_id=${sessionId}; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=86400`;
}

function clearSessionCookie(env: string): string {
  const secure = env !== 'development' ? '; Secure' : '';
  return `session_id=; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=0`;
}

// GET /auth/login — redirect to Okta
authRoutes.get('/login', async (c) => {
  if (c.env.ENVIRONMENT === 'development') {
    return c.redirect('/admin/');
  }

  const redirect = c.req.query('redirect');
  const config = getOktaConfig(c.env, c.req.url);
  const authUrl = await getAuthorizationUrl(c.env.CACHE, config, redirect);
  return c.redirect(authUrl);
});

// GET /auth/callback — exchange code for tokens, create session
authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    const desc = c.req.query('error_description') || error;
    return c.text(`Authentication error: ${desc}`, 401);
  }

  if (!code || !state) {
    return c.text('Missing code or state parameter', 400);
  }

  try {
    const config = getOktaConfig(c.env, c.req.url);

    const { tokens, redirectAfterLogin } = await handleCallback(c.env.CACHE, config, code, state);

    const payload = await verifyIdToken(
      c.env.CACHE,
      tokens.id_token,
      config.clientId,
      config.domain
    );

    const groups = payload.groups || [];
    const role = resolveRole(groups);

    const sessionId = await createSession(c.env.CACHE, {
      email: payload.email,
      role,
      idToken: tokens.id_token,
    });

    const destination = redirectAfterLogin || '/admin/';
    return new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        'Set-Cookie': sessionCookie(sessionId, c.env.ENVIRONMENT),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Auth callback error:', message);
    return c.text(`Authentication failed: ${message}`, 401);
  }
});

// POST /auth/logout — destroy session, redirect to Okta logout
authRoutes.post('/logout', async (c) => {
  const sessionId = getSessionIdFromCookie(c.req.header('Cookie'));

  let idToken: string | undefined;
  if (sessionId) {
    const session = await getSession(c.env.CACHE, sessionId);
    idToken = session?.idToken;
    await deleteSession(c.env.CACHE, sessionId);
  }

  const url = new URL(c.req.url);

  if (c.env.ENVIRONMENT === 'development') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': clearSessionCookie(c.env.ENVIRONMENT),
      },
    });
  }

  const config = getOktaConfig(c.env, c.req.url);
  const logoutUrl = getLogoutUrl(config, url.origin, idToken);

  return new Response(null, {
    status: 302,
    headers: {
      Location: logoutUrl,
      'Set-Cookie': clearSessionCookie(c.env.ENVIRONMENT),
    },
  });
});

// GET /auth/me — return current user from session
authRoutes.get('/me', async (c) => {
  if (c.env.ENVIRONMENT === 'development') {
    return c.json({
      email: 'admin@dev.local',
      role: 'admin',
    });
  }

  const sessionId = getSessionIdFromCookie(c.req.header('Cookie'));
  if (!sessionId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const session = await getSession(c.env.CACHE, sessionId);
  if (!session) {
    return c.json({ error: 'Session expired' }, 401);
  }

  return c.json({ email: session.email, role: session.role });
});
