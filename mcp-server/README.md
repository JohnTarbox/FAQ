# FAQ / Glossary MCP Server

A second Cloudflare Worker that exposes the FAQ/Glossary data to Claude via the
Model Context Protocol — usable both from **claude.ai** (remote connector, OAuth
via Okta) and **Claude Code** (`.mcp.json`, static bearer token).

It reuses the main app's service classes (`FaqService`, `GlossaryService`,
`SuggestionService`, `SearchService`, `ImageService`) by importing them from
`../src/services/*`, and binds the **same** D1/KV/R2 as the main app. The main
app at `faq.aprs.works` is untouched.

## Security model

| Caller | Credential | Tools | Audit actor |
|---|---|---|---|
| Anyone | none | read-only | — |
| Claude Code | `Authorization: Bearer <MCP_WRITE_TOKEN>` | read + write | `MCP_ACTOR_EMAIL` |
| claude.ai | OAuth (Okta login) | read + write | the real Okta user's email |

**Writes are drafts only.** Every create/edit lands as a `draft` (or
`pending_review`) and a human approves/publishes in the admin UI. There are no
approve/publish tools. `glossary_update` structurally omits the `status` field
so an agent cannot publish. Routing is decided in `src/auth.ts:classifyRequest`
and dispatched in `src/index.ts`.

## Layout

- `src/index.ts` — entry: dual-path `fetch`, the `FaqMcp` Durable Object (OAuth
  path), and the stateless read / static-token handlers.
- `src/server.ts` — `registerAllTools` / `buildServer` (single source of the
  tool set, shared by all three surfaces).
- `src/auth.ts` — role mapping, `Actor`, and the pure `classifyRequest`.
- `src/oauth/` — `okta-handler.ts` (the OAuth defaultHandler) + `okta.ts` (PKCE
  helpers). Verifies the Okta id_token via the main app's `jwks.service`.
- `src/tools/` — one file per entity (`faq`, `glossary`, `suggestions`,
  `images`) + `common.ts`.
- `src/transport-collision-fix.ts` — guards upstream MCP SDK #1186.

## Local development

```bash
cd mcp-server
cp .dev.vars.example .dev.vars      # fill MCP_WRITE_TOKEN + Okta creds
# wrangler needs the account's token (same as the main app):
export $(grep -v '^#' ../.env | xargs)   # sets CLOUDFLARE_API_TOKEN / ACCOUNT_ID
npx wrangler whoami                  # MUST show APRS Foundation (d8e8483...)
npm run dev                          # http://localhost:8788
```

### Verify (run in a normal terminal — these need the server running)

```bash
# 1. Health (claude.ai probes this)
curl http://localhost:8788/

# 2. OAuth discovery (proves the provider is mounted)
curl http://localhost:8788/.well-known/oauth-authorization-server

# 3. Read-only surface (no auth) — initialize then list; only read tools appear
npx @modelcontextprotocol/inspector --cli http://localhost:8788/mcp --method tools/list

# 4. Write surface (Claude Code path) — read + write tools appear
npx @modelcontextprotocol/inspector --cli http://localhost:8788/mcp \
  --header "Authorization: Bearer $MCP_WRITE_TOKEN" --method tools/list

# 5. Create a draft, then confirm it shows up pending review in the admin UI
npx @modelcontextprotocol/inspector --cli http://localhost:8788/mcp \
  --header "Authorization: Bearer $MCP_WRITE_TOKEN" \
  --method tools/call --tool-name faq_create \
  --tool-arg question="What is APRS?" --tool-arg answer="Automatic Packet Reporting System."
```

`whoami` (a read tool) reports which surface you landed on and the tool count.

## Tests

```bash
npm test        # auth-route classification, tool-gating surface, drafts-only schema
```

D1-backed behaviour (a `faq_create` produces a `draft` row + audit entry) is
confirmed via step 5 above against `wrangler dev`.

## Deploy

```bash
cd mcp-server
export $(grep -v '^#' ../.env | xargs)
npx wrangler whoami                  # verify APRS Foundation account first

# secrets (one-time)
openssl rand -base64 32 | npx wrangler secret put MCP_WRITE_TOKEN
npx wrangler secret put OKTA_CLIENT_ID
npx wrangler secret put OKTA_CLIENT_SECRET

npm run deploy
```

Then, in Okta, add the callback URL to the OIDC app's allowed redirect URIs:

- `https://mcp.faq.aprs.works/callback` (production)
- `http://localhost:8788/callback` (local dev)

### Connect from claude.ai

Settings → Connectors → Add custom connector → `https://mcp.faq.aprs.works/mcp`.
It performs Dynamic Client Registration, redirects to Okta to log in, and on
return you can call tools. Run `whoami` to confirm your Okta email + role.

### Connect from Claude Code

The repo's `../.mcp.json` already has a `faq` entry pointing at the production
URL with `Authorization: Bearer ${FAQ_MCP_WRITE_TOKEN}`. Export the token and
restart Claude Code:

```bash
export FAQ_MCP_WRITE_TOKEN="<the MCP_WRITE_TOKEN you set above>"
```

(For purely local testing, change that entry's `url` to
`http://localhost:8788/mcp`.)

## Notes

- `OAUTH_KV` is currently bound to the same namespace id as `CACHE` so the
  Worker deploys without provisioning a new namespace. For stronger token
  isolation, create a dedicated namespace (`wrangler kv namespace create
  OAUTH_KV`) and replace the id in `wrangler.toml`.
- This is a separate Worker on the **APRS Foundation** Cloudflare account. Per
  the repo's CLAUDE.md, always run `wrangler whoami` before any deploy/secret/kv
  command.
