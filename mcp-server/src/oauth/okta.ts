/**
 * Okta OIDC Authorization-Code + PKCE helpers for the MCP OAuth bridge.
 *
 * This Worker is an OAuth *server* to claude.ai (via workers-oauth-provider)
 * and an OAuth *client* to Okta (the existing IdP). These helpers handle the
 * client side. Adapted from the main app's src/services/okta.service.ts, with
 * one difference: we stash the provider's parsed auth request alongside the
 * PKCE verifier under a single state key, so /callback can complete the
 * downstream (claude.ai) authorization after the upstream (Okta) login.
 */

export interface OktaConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface StoredState {
  codeVerifier: string;
  /** The OAuthProvider's parsed auth request (opaque to us). */
  oauthReqInfo: unknown;
}

interface TokenResponse {
  id_token: string;
  access_token: string;
  token_type: string;
  expires_in: number;
}

const STATE_PREFIX = "mcp_oauth:";
const STATE_TTL = 60 * 10; // 10 minutes

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/**
 * Build the Okta authorize URL and persist the PKCE verifier + the downstream
 * auth request under a freshly generated state value (returned embedded in the
 * URL). Call from GET /authorize.
 */
export async function buildOktaAuthUrl(
  kv: KVNamespace,
  config: OktaConfig,
  oauthReqInfo: unknown
): Promise<string> {
  const state = randomString(32);
  const verifier = randomString(32);
  const challenge = await codeChallenge(verifier);

  const stored: StoredState = { codeVerifier: verifier, oauthReqInfo };
  await kv.put(`${STATE_PREFIX}${state}`, JSON.stringify(stored), { expirationTtl: STATE_TTL });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid profile email groups",
    redirect_uri: config.redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://${config.domain}/oauth2/v1/authorize?${params}`;
}

/**
 * Exchange the Okta authorization code for tokens and return them together with
 * the stored downstream auth request. Call from GET /callback. Consumes the
 * one-time state key.
 */
export async function exchangeOktaCode(
  kv: KVNamespace,
  config: OktaConfig,
  code: string,
  state: string
): Promise<{ tokens: TokenResponse; oauthReqInfo: unknown }> {
  const raw = await kv.get(`${STATE_PREFIX}${state}`);
  if (!raw) throw new Error("Invalid or expired state parameter");
  await kv.delete(`${STATE_PREFIX}${state}`);
  const stored = JSON.parse(raw) as StoredState;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: stored.codeVerifier,
  });

  const res = await fetch(`https://${config.domain}/oauth2/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Okta token exchange failed: ${res.status} ${await res.text()}`);
  }
  const tokens = (await res.json()) as TokenResponse;
  return { tokens, oauthReqInfo: stored.oauthReqInfo };
}
