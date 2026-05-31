# Connecting to the FAQ / Glossary MCP server

The server is live at:

```
https://mcp.faq.aprs.works/mcp
```

It lets Claude read and write the APRS FAQ/Glossary content. **Published content
is readable anonymously (via `?anon=1`); writes (and internal reads like
drafts/audit logs) require a credential. Writes always land as drafts** for a
human to approve in the admin UI — Claude can't publish. A bare `/mcp` with no
credential returns a 401 OAuth challenge (so claude.ai prompts for login) rather
than serving anonymously — see the tiers below.

## Access tiers

| How you connect | Credential | What you can do |
|---|---|---|
| **claude.ai / Claude cowork** | Okta login (OAuth) | read + write (drafts), as *you* |
| **Claude Code (CLI)** | static bearer token | read + write (drafts), as the MCP bot |
| Any MCP client, `/mcp?anon=1` | none | read **published** content only |

---

## Option A — claude.ai or Claude cowork (OAuth via Okta)

Best for using it from the web / another computer without copying secrets.

1. Open **Settings → Connectors** (or **Add custom connector**).
2. Add a custom connector with the URL:
   ```
   https://mcp.faq.aprs.works/mcp
   ```
3. It will register automatically and open an **Okta sign-in** window. Log in
   with your APRS Okta account.
4. After login you'll be returned and the connector shows **Connected**.
5. In a chat, ask Claude to run the **`whoami`** tool to confirm — you should
   see `authenticated: true`, your email, your role, and `toolCount: 33`.

Your writes are attributed to your real Okta email in the audit log. Your role
(`admin`/`reviewer`/`author`) comes from your Okta `CMS-*` groups; any of them
can create drafts.

---

## Option B — Claude Code (CLI) with the static token

Best for driving it from a terminal. You need the **write token**
(`MCP_WRITE_TOKEN`) — ask John, or retrieve it from the deploy notes. Treat it
like a password.

**Fastest — `claude mcp add`:**

```bash
claude mcp add --transport http faq https://mcp.faq.aprs.works/mcp \
  --header "Authorization: Bearer <MCP_WRITE_TOKEN>" \
  --scope user        # or --scope project to write it into ./.mcp.json
```

**Or by hand — create `.mcp.json`** in your project root (it supports
`${VAR}` expansion so the token stays out of the file):

```json
{
  "mcpServers": {
    "faq": {
      "type": "http",
      "url": "https://mcp.faq.aprs.works/mcp",
      "headers": { "Authorization": "Bearer ${FAQ_MCP_WRITE_TOKEN}" }
    }
  }
}
```

```bash
export FAQ_MCP_WRITE_TOKEN='<MCP_WRITE_TOKEN>'   # put in your shell profile
```

Then **restart Claude Code**. Verify with `/mcp` (it should list `faq` as
connected) or ask Claude to run the `whoami` tool — `role` will be `bot`,
`canWrite: true`.

**Read-only (no token):** use the URL `https://mcp.faq.aprs.works/mcp?anon=1`
(no `Authorization` header) → the 11 public read tools only. Note: a bare
`/mcp` with no token returns a 401 OAuth challenge (that's what makes claude.ai
start the Okta flow), so anonymous access needs the explicit `?anon=1`.

---

## Tools

**Public reads (everyone):** `faq_list`, `faq_get` (by slug), `faq_search`,
`faq_categories_list`, `faq_tags_list`, `glossary_list`, `glossary_get` (by
slug), `glossary_search`, `glossary_categories_list`, `images_list`, `whoami`.

**Internal reads (authenticated):** `faq_versions`, `faq_audit_log`,
`suggestions_list`, `suggestions_get`, `suggestions_stats`, plus id-based
`*_get` and all-status `*_list`.

**Writes (authenticated):**
- FAQ: `faq_create`, `faq_create_version`, `faq_update_entry`, `faq_set_tags`,
  `faq_delete`, `faq_category_create`, `faq_tag_create`
- Glossary: `glossary_create`, `glossary_update`, `glossary_set_related`,
  `glossary_delete`, `glossary_category_create`
- Suggestions: `suggestion_accept`, `suggestion_dismiss`,
  `suggestions_bulk_dismiss`
- Images: `image_upload` (base64), `image_delete`

`glossary_update` has no `status` field and there are no approve/publish tools —
by design, Claude can only produce drafts.

## Example prompts

- "Search the FAQ for APRS digipeating and summarize what's there."
- "Draft a new FAQ: Q = 'What is a digipeater?', A = '…', category … " → then
  check the admin UI; it appears **pending review**.
- "List the glossary terms still in draft." (authenticated only)
- "Accept AI suggestion #42, but tighten the answer to two sentences." → creates
  a draft FAQ.
- "What can I do here?" → runs `whoami`.

## Notes

- **Drafts only.** Everything Claude creates/edits is a draft; publish it
  yourself in the admin UI at `https://faq.aprs.works/admin`.
- **Token = password.** The static write token grants write access as the bot.
  Don't commit it. To rotate it:
  `openssl rand -base64 32 | wrangler secret put MCP_WRITE_TOKEN` (run from
  `mcp-server/` on the APRS Foundation account), then update your clients.
- Custom domain: `mcp.faq.aprs.works`. The `*.workers.dev` URL also works if
  the custom domain ever has issues.
