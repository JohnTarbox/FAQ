/**
 * FAQ / Glossary MCP Worker.
 *
 * Reads are open; writes require a credential. Three surfaces share one tool
 * set (see server.ts):
 *   - claude.ai  : OAuth (Okta upstream) → McpAgent Durable Object, real email
 *   - Claude Code: static `Bearer <MCP_WRITE_TOKEN>` → stateless full-tool server
 *   - anyone     : no Authorization → stateless read-only server
 *
 * The top-level fetch classifies each request (auth.ts:classifyRequest) and
 * dispatches before workers-oauth-provider can 401 the open-read case. A
 * non-matching Bearer (a provider-issued OAuth token) falls through to the
 * provider, which routes it to the Durable Object.
 */
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { getCurrentAgent } from "agents";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OktaHandler } from "./oauth/okta-handler";
import { registerAllTools, buildServer, SERVER_INFO } from "./server";
import {
  classifyRequest,
  actorFromProps,
  actorFromStaticToken,
  ANONYMOUS_ACTOR,
} from "./auth";
import {
  decideSendRouting,
  sendViaConnection,
  type ConnectionLike,
  type TransportPrivates,
} from "./transport-collision-fix";
import { enforceRateLimit } from "./ratelimit";
import type { Env, UserProps } from "./env";

const DEFAULT_ACTOR_EMAIL = "mcp-bot@aprsfoundation.org";

// ---------------------------------------------------------------------------
// Durable Object — MCP agent for the claude.ai OAuth path
// ---------------------------------------------------------------------------
export class FaqMcp extends McpAgent<Env, Record<string, never>, UserProps> {
  // Cast: agents and @modelcontextprotocol/sdk bundle separate McpServer copies
  // with identical public APIs but incompatible private fields.
  server = new McpServer(SERVER_INFO) as any;

  async init() {
    const actor = this.props ? actorFromProps(this.props) : ANONYMOUS_ACTOR;
    registerAllTools(this.server, this.env, actor);
  }

  // Routing fix for upstream MCP TS SDK #1186 — see transport-collision-fix.ts.
  // Records the originating connection at message intake and direct-writes
  // responses on a fixable collision, so concurrent claude.ai tool calls never
  // get cross-wired to the wrong client's socket.
  async onStart(props?: UserProps) {
    await super.onStart(props);
    const transport = (this as unknown as { _transport?: unknown })._transport as
      | (TransportPrivates & {
          send?: (m: unknown, o?: { relatedRequestId?: unknown }) => Promise<unknown>;
          onmessage?: (m: unknown, extra: unknown) => unknown;
        })
      | undefined;
    if (!transport || typeof transport.send !== "function") return;

    const intakeConnByReqId = new Map<unknown, string>();

    const originalOnMessage = transport.onmessage;
    if (typeof originalOnMessage === "function") {
      const boundOnMessage = originalOnMessage.bind(transport);
      transport.onmessage = (m: unknown, extra: unknown) => {
        try {
          const message = m as { id?: unknown };
          if (message && message.id !== undefined && message.id !== null) {
            const { connection } = getCurrentAgent();
            if (connection?.id) intakeConnByReqId.set(message.id, connection.id);
          }
        } catch {
          /* never block intake on tracking failure */
        }
        return boundOnMessage(m, extra);
      };
    }

    const originalSend = transport.send.bind(transport);
    const getConnsArr = (): ConnectionLike[] =>
      Array.from(this.getConnections() ?? []) as ConnectionLike[];

    transport.send = async (m: unknown, o?: { relatedRequestId?: unknown }) => {
      const message = m as { id?: unknown };
      const reqId = o?.relatedRequestId ?? message?.id;

      const tracked =
        reqId !== undefined && reqId !== null ? intakeConnByReqId.get(reqId) : undefined;
      if (reqId !== undefined && reqId !== null) intakeConnByReqId.delete(reqId);

      const decision = decideSendRouting(getConnsArr(), reqId, tracked);

      if (decision.kind === "passthrough") return originalSend(m, o);

      if (decision.kind === "ambiguous") {
        throw new Error(
          `MCP response routing ambiguous for request id ${String(reqId)}; caller should re-fetch the underlying record.`
        );
      }

      await sendViaConnection(transport, decision.connection, m, reqId);
    };
  }
}

// ---------------------------------------------------------------------------
// OAuth provider — serves /authorize (→ Okta), /token, /register, .well-known,
// and routes authenticated /mcp + /sse to the Durable Object.
// ---------------------------------------------------------------------------
const oauthProvider = new OAuthProvider({
  apiHandlers: {
    "/mcp": FaqMcp.serve("/mcp") as any,
    "/sse": FaqMcp.serveSSE("/sse") as any,
  },
  defaultHandler: OktaHandler as any,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});

// ---------------------------------------------------------------------------
// Stateless handlers (no Durable Object) for the non-OAuth surfaces
// ---------------------------------------------------------------------------
async function handleStatelessMcp(request: Request, server: McpServer): Promise<Response> {
  const { WebStandardStreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
  );
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

/** No auth → read-only tool set. */
function handleOpenReadMcp(request: Request, env: Env): Promise<Response> {
  return handleStatelessMcp(request, buildServer(env, ANONYMOUS_ACTOR));
}

/** Valid static token → full tool set under the synthetic bot actor. */
function handleStaticTokenMcp(request: Request, env: Env): Promise<Response> {
  const actor = actorFromStaticToken(env.MCP_ACTOR_EMAIL || DEFAULT_ACTOR_EMAIL);
  return handleStatelessMcp(request, buildServer(env, actor));
}

function infoJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const auth = request.headers.get("Authorization");
    // Anonymous read access is an explicit opt-in (?anon=1). A bare /mcp with no
    // token instead falls through to the OAuth provider's 401 challenge, which
    // is what claude.ai / cowork needs to launch the Okta login.
    const allowAnon = url.searchParams.get("anon") === "1";
    const route = classifyRequest(request.method, url.pathname, auth, env.MCP_WRITE_TOKEN, allowAnon);

    switch (route) {
      case "info":
        return infoJson({ ...SERVER_INFO, description: "FAQ/Glossary MCP server" });
      case "version":
        return infoJson({ ...SERVER_INFO });
      case "open-read": {
        // Anonymous reads only: throttle per client IP to protect D1.
        const limited = await enforceRateLimit(env.READ_RATE_LIMITER, request);
        return limited ?? handleOpenReadMcp(request, env);
      }
      case "static-write":
        return handleStaticTokenMcp(request, env);
      case "oauth":
      default:
        return oauthProvider.fetch(request, env, ctx);
    }
  },
} satisfies ExportedHandler<Env>;
