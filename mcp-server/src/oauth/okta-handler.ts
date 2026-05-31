/**
 * OAuth defaultHandler for workers-oauth-provider. Bridges claude.ai's OAuth
 * dance to Okta:
 *
 *   GET /            — server info (claude.ai probes this)
 *   GET /authorize   — parse the provider's auth request, redirect to Okta
 *   GET /callback    — exchange the Okta code, verify the id_token, then
 *                      completeAuthorization() back to claude.ai with props
 *
 * The provider itself serves /token, /register and the /.well-known discovery
 * documents; those never reach this handler.
 */
import { Hono } from "hono";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { verifyIdToken } from "../../../src/services/jwks.service";
import { buildOktaAuthUrl, exchangeOktaCode, type OktaConfig } from "./okta";
import { resolveRole } from "../auth";
import type { Env, UserProps } from "../env";

type HandlerEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

const app = new Hono<{ Bindings: HandlerEnv }>();

function oktaConfig(env: HandlerEnv, request: Request): OktaConfig {
  return {
    domain: env.OKTA_DOMAIN,
    clientId: env.OKTA_CLIENT_ID,
    clientSecret: env.OKTA_CLIENT_SECRET,
    redirectUri: new URL("/callback", request.url).toString(),
  };
}

// Server info — claude.ai probes the root before starting OAuth.
app.get("/", (c) =>
  c.json({ name: "APRS FAQ & Glossary", version: "1.0.0", description: "FAQ/Glossary MCP server" })
);

// Start the OAuth flow: stash the provider's request, redirect to Okta login.
app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  if (!oauthReqInfo.clientId) {
    return c.text("Invalid authorization request", 400);
  }
  const url = await buildOktaAuthUrl(c.env.OAUTH_KV, oktaConfig(c.env, c.req.raw), oauthReqInfo);
  return c.redirect(url, 302);
});

// Okta redirects here after login. Verify identity, then hand a fresh
// authorization code back to claude.ai via completeAuthorization().
app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oktaError = c.req.query("error");
  if (oktaError) {
    return c.text(`Okta returned an error: ${oktaError} ${c.req.query("error_description") ?? ""}`, 400);
  }
  if (!code || !state) {
    return c.text("Missing code or state from Okta", 400);
  }

  let tokens: { id_token: string };
  let oauthReqInfo: unknown;
  try {
    const result = await exchangeOktaCode(c.env.OAUTH_KV, oktaConfig(c.env, c.req.raw), code, state);
    tokens = result.tokens;
    oauthReqInfo = result.oauthReqInfo;
  } catch (err) {
    return c.text(
      `Sign-in failed: ${err instanceof Error ? err.message : "token exchange error"}`,
      400
    );
  }

  let payload;
  try {
    payload = await verifyIdToken(c.env.OAUTH_KV, tokens.id_token, c.env.OKTA_CLIENT_ID, c.env.OKTA_DOMAIN);
  } catch (err) {
    return c.text(`Could not verify your identity: ${err instanceof Error ? err.message : "invalid token"}`, 400);
  }

  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const props: UserProps = {
    email: payload.email,
    role: resolveRole(groups),
    groups,
  };

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo as Parameters<OAuthHelpers["completeAuthorization"]>[0]["request"],
    userId: payload.email,
    scope: (oauthReqInfo as { scope?: string[] }).scope ?? [],
    props,
    metadata: {},
  });

  return c.redirect(redirectTo, 302);
});

export { app as OktaHandler };
