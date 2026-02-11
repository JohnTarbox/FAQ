export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
}
