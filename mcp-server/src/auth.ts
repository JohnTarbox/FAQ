/**
 * Actor resolution + request classification for the MCP Worker.
 *
 * Reads are open; writes require a credential. There are three credential
 * paths, classified by `classifyRequest()` purely from method/path/headers:
 *   - open-read   : no Authorization header → read-only tool set
 *   - static-write: Authorization === `Bearer <MCP_WRITE_TOKEN>` → full tools,
 *                   synthetic bot actor (Claude Code via .mcp.json)
 *   - oauth       : anything else (incl. provider-issued Bearer tokens, the
 *                   /authorize|/token|/register|/callback OAuth dance) → handed
 *                   to workers-oauth-provider, which yields a real Okta identity
 */

// Mirrors src/middleware/auth.ts in the main app. Re-implemented here (rather
// than imported) to keep the MCP Worker bundle free of the main app's request
// context + session.service. Keep in sync if the role model changes.
export type UserRole = "admin" | "reviewer" | "author";

const ROLE_HIERARCHY: Record<UserRole, number> = { admin: 3, reviewer: 2, author: 1 };

export function resolveRole(groups: string[]): UserRole {
  if (groups.includes("CMS-Admins")) return "admin";
  if (groups.includes("CMS-Reviewers")) return "reviewer";
  return "author";
}

export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/** Identity + capability passed to every tool factory. */
export interface Actor {
  /** Email used for audit trails (authorEmail / actorEmail / createdBy). */
  email: string;
  role: UserRole | "bot";
  /** Whether write tools should be registered for this caller. */
  canWrite: boolean;
}

/** Actor for an authenticated Okta user (claude.ai OAuth path). */
export function actorFromProps(props: { email: string; role: UserRole }): Actor {
  return {
    email: props.email,
    role: props.role,
    // Any authenticated Okta user may create drafts — drafts require human
    // approval in the admin UI before publishing. Tighten to
    // hasMinRole(props.role, "reviewer") to restrict to CMS staff.
    canWrite: hasMinRole(props.role, "author"),
  };
}

/** Actor for a static-token write (Claude Code). The secret is the gate. */
export function actorFromStaticToken(actorEmail: string): Actor {
  return { email: actorEmail, role: "bot", canWrite: true };
}

/** Read-only actor for unauthenticated callers. */
export const ANONYMOUS_ACTOR: Actor = {
  email: "anonymous",
  role: "bot",
  canWrite: false,
};

export type RequestRoute = "info" | "version" | "open-read" | "static-write" | "oauth";

/**
 * Pure routing decision for the top-level fetch handler. Order matters:
 * a non-matching Bearer (e.g. a provider-issued OAuth token) MUST fall through
 * to "oauth", never be treated as unauthorized here — claude.ai sends its
 * issued access token as `Bearer` on every /mcp request.
 */
export function classifyRequest(
  method: string,
  pathname: string,
  authHeader: string | null,
  writeToken: string | undefined
): RequestRoute {
  if (method === "GET" && pathname === "/") return "info";
  if (method === "GET" && pathname === "/version") return "version";

  const isMcpPath = pathname === "/mcp" || pathname === "/sse";
  if (isMcpPath) {
    if (!authHeader) return "open-read";
    if (writeToken && authHeader === `Bearer ${writeToken}`) return "static-write";
  }
  return "oauth";
}
