export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  IMAGES: R2Bucket;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
}
