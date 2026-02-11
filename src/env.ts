export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
  OKTA_DOMAIN: string;
  OKTA_CLIENT_ID: string;
  OKTA_CLIENT_SECRET: string;
}
