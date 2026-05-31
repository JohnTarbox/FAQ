/** Shared helpers for MCP tool factories. */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Wrap any value as an MCP text-content result (pretty-printed JSON). */
export function jsonContent(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** Surface an error to the caller as an MCP tool error result. */
export function errorContent(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Slug generation — identical to the main app's admin routes. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Normalize a Zod `.url().or(literal(''))` field to undefined when blank. */
export function blankToUndefined(value: string | undefined): string | undefined {
  return value ? value : undefined;
}
