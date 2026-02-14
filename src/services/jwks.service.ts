/** Okta JWKS fetching, caching, and RS256 ID token verification */

interface JWK {
  kty: string;
  kid: string;
  use: string;
  n: string;
  e: string;
  alg: string;
}

interface JWKSResponse {
  keys: JWK[];
}

interface IdTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  email: string;
  groups?: string[];
  [key: string]: unknown;
}

const JWKS_CACHE_KEY = 'okta:jwks';
const JWKS_CACHE_TTL = 60 * 60; // 1 hour

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtPart(part: string): Record<string, unknown> {
  const decoded = new TextDecoder().decode(base64UrlDecode(part));
  return JSON.parse(decoded);
}

async function fetchJwks(
  kv: KVNamespace,
  oktaDomain: string,
  forceRefresh = false
): Promise<JWK[]> {
  if (!forceRefresh) {
    const cached = await kv.get(JWKS_CACHE_KEY);
    if (cached) return (JSON.parse(cached) as JWKSResponse).keys;
  }

  const url = `https://${oktaDomain}/oauth2/v1/keys`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);

  const jwks = (await res.json()) as JWKSResponse;
  await kv.put(JWKS_CACHE_KEY, JSON.stringify(jwks), {
    expirationTtl: JWKS_CACHE_TTL,
  });
  return jwks.keys;
}

async function importRsaKey(jwk: JWK): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

async function verifySignature(
  key: CryptoKey,
  headerAndPayload: string,
  signature: string
): Promise<boolean> {
  const data = new TextEncoder().encode(headerAndPayload);
  const sig = base64UrlDecode(signature);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
}

export async function verifyIdToken(
  kv: KVNamespace,
  token: string,
  clientId: string,
  oktaDomain: string
): Promise<IdTokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const header = decodeJwtPart(parts[0]) as { kid: string; alg: string };
  if (header.alg !== 'RS256') throw new Error(`Unsupported algorithm: ${header.alg}`);

  // Try with cached keys first, then refresh on failure
  for (const forceRefresh of [false, true]) {
    const keys = await fetchJwks(kv, oktaDomain, forceRefresh);
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      if (!forceRefresh) continue; // retry with fresh keys
      throw new Error(`No matching key found for kid: ${header.kid}`);
    }

    const cryptoKey = await importRsaKey(jwk);
    const valid = await verifySignature(cryptoKey, `${parts[0]}.${parts[1]}`, parts[2]);
    if (!valid) throw new Error('Invalid token signature');

    const payload = decodeJwtPart(parts[1]) as IdTokenPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) throw new Error('Token expired');
    if (payload.iss !== `https://${oktaDomain}`) {
      throw new Error(`Invalid issuer: ${payload.iss}`);
    }
    if (payload.aud !== clientId) {
      throw new Error(`Invalid audience: ${payload.aud}`);
    }

    return payload;
  }

  throw new Error('Token verification failed');
}
