import { ref } from 'vue';

const BASE = '/api/admin';

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };

  // Only set content-type for non-FormData bodies
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: 'same-origin' });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export function useApi() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function call<T>(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fn();
      return result;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, call, get: <T>(p: string) => request<T>(p), post: <T>(p: string, b?: unknown) => request<T>(p, { method: 'POST', body: b instanceof FormData ? b : JSON.stringify(b) }), put: <T>(p: string, b: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(b) }), del: <T>(p: string) => request<T>(p, { method: 'DELETE' }) };
}
