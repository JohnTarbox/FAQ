/** Server-side session storage backed by Cloudflare KV */

export interface SessionData {
  email: string;
  role: string;
  idToken?: string;
  createdAt: number;
}

const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds
const KEY_PREFIX = 'session:';

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(
  kv: KVNamespace,
  data: Omit<SessionData, 'createdAt'>
): Promise<string> {
  const sessionId = generateSessionId();
  const session: SessionData = { ...data, createdAt: Date.now() };
  await kv.put(`${KEY_PREFIX}${sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });
  return sessionId;
}

export async function getSession(
  kv: KVNamespace,
  sessionId: string
): Promise<SessionData | null> {
  const raw = await kv.get(`${KEY_PREFIX}${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function deleteSession(
  kv: KVNamespace,
  sessionId: string
): Promise<void> {
  await kv.delete(`${KEY_PREFIX}${sessionId}`);
}
