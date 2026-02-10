export class CacheService {
  private kv: KVNamespace;
  private prefix: string;

  constructor(kv: KVNamespace, prefix = 'faq-glossary') {
    this.kv = kv;
    this.prefix = prefix;
  }

  private key(parts: string[]): string {
    return `${this.prefix}:${parts.join(':')}`;
  }

  async get<T>(parts: string[]): Promise<T | null> {
    const value = await this.kv.get(this.key(parts), 'json');
    return value as T | null;
  }

  async set(parts: string[], data: unknown, ttlSeconds?: number): Promise<void> {
    const opts: KVNamespacePutOptions = {};
    if (ttlSeconds) opts.expirationTtl = ttlSeconds;
    await this.kv.put(this.key(parts), JSON.stringify(data), opts);
  }

  async delete(parts: string[]): Promise<void> {
    await this.kv.delete(this.key(parts));
  }

  async invalidatePattern(prefix: string[]): Promise<void> {
    const keyPrefix = this.key(prefix);
    const listed = await this.kv.list({ prefix: keyPrefix });
    await Promise.all(listed.keys.map(k => this.kv.delete(k.name)));
  }

  // Convenience methods for FAQ
  async getFaqList(page: number, category?: string): Promise<unknown | null> {
    return this.get(['faq', 'list', String(page), category || 'all']);
  }

  async setFaqList(page: number, category: string | undefined, data: unknown): Promise<void> {
    await this.set(['faq', 'list', String(page), category || 'all'], data);
  }

  async getFaqBySlug(slug: string): Promise<unknown | null> {
    return this.get(['faq', 'detail', slug]);
  }

  async setFaqBySlug(slug: string, data: unknown): Promise<void> {
    await this.set(['faq', 'detail', slug], data);
  }

  async invalidateFaq(): Promise<void> {
    await this.invalidatePattern(['faq']);
  }

  // Convenience methods for Glossary
  async getGlossaryAll(): Promise<unknown | null> {
    return this.get(['glossary', 'all']);
  }

  async setGlossaryAll(data: unknown): Promise<void> {
    await this.set(['glossary', 'all'], data);
  }

  async getGlossaryBySlug(slug: string): Promise<unknown | null> {
    return this.get(['glossary', 'detail', slug]);
  }

  async setGlossaryBySlug(slug: string, data: unknown): Promise<void> {
    await this.set(['glossary', 'detail', slug], data);
  }

  async getTermsIndex(): Promise<unknown | null> {
    return this.get(['glossary', 'terms-index']);
  }

  async setTermsIndex(data: unknown): Promise<void> {
    await this.set(['glossary', 'terms-index'], data);
  }

  async invalidateGlossary(): Promise<void> {
    await this.invalidatePattern(['glossary']);
  }
}
