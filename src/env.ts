export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  AI: Ai;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
  OKTA_DOMAIN: string;
  OKTA_CLIENT_ID: string;
  OKTA_CLIENT_SECRET: string;
  OKTA_API_TOKEN: string;
  YOUTUBE_API_KEY?: string;
  GOOGLE_SEARCH_API_KEY?: string;
  GOOGLE_SEARCH_CX_ID?: string;
}
