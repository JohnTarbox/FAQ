export class ImageService {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  async upload(file: File | Blob, path: string, contentType: string): Promise<string> {
    const key = `images/${path}`;
    await this.bucket.put(key, file, {
      httpMetadata: { contentType },
    });
    return `/${key}`;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async list(prefix = 'images/', limit = 100, cursor?: string) {
    const result = await this.bucket.list({ prefix, limit, cursor });
    return {
      items: result.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        contentType: obj.httpMetadata?.contentType,
      })),
      cursor: result.truncated ? result.cursor : undefined,
    };
  }

  static generatePath(filename: string, folder: 'faq' | 'glossary'): string {
    const ext = filename.split('.').pop()?.toLowerCase() || 'webp';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${folder}/${timestamp}-${random}.${ext}`;
  }
}
