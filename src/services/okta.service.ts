/** Okta OIDC Authorization Code + PKCE flow orchestration */

export interface OktaConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface PKCEState {
  codeVerifier: string;
  redirectAfterLogin?: string;
}

interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

const PKCE_TTL = 60 * 5; // 5 minutes

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(digest);
}

export async function getAuthorizationUrl(
  kv: KVNamespace,
  config: OktaConfig,
  redirectAfterLogin?: string
): Promise<string> {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const pkceState: PKCEState = { codeVerifier, redirectAfterLogin };
  await kv.put(`pkce:${state}`, JSON.stringify(pkceState), {
    expirationTtl: PKCE_TTL,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid profile email groups',
    redirect_uri: config.redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://${config.domain}/oauth2/v1/authorize?${params}`;
}

export async function handleCallback(
  kv: KVNamespace,
  config: OktaConfig,
  code: string,
  state: string
): Promise<{ tokens: TokenResponse; redirectAfterLogin?: string }> {
  const raw = await kv.get(`pkce:${state}`);
  if (!raw) throw new Error('Invalid or expired state parameter');

  const pkceState = JSON.parse(raw) as PKCEState;
  await kv.delete(`pkce:${state}`);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: pkceState.codeVerifier,
  });

  const res = await fetch(`https://${config.domain}/oauth2/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  const tokens = (await res.json()) as TokenResponse;
  return { tokens, redirectAfterLogin: pkceState.redirectAfterLogin };
}

export function getLogoutUrl(config: OktaConfig, postLogoutRedirectUri: string, idToken?: string): string {
  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
  if (idToken) params.set('id_token_hint', idToken);
  return `https://${config.domain}/oauth2/v1/logout?${params}`;
}
