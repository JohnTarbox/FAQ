/**
 * Image tools (R2). MCP has no binary transport, so uploads take base64 and we
 * decode to bytes with atob (no Node Buffer). Content type is constrained to
 * the same allow-list the admin upload route uses, and size is capped at 10MB.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ImageService } from "../../../src/services/image.service";
import { jsonContent, errorContent } from "./common";
import type { Env } from "../env";
import type { Actor } from "../auth";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB, matching admin/images.routes.ts

const CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
} as const;

export function registerImageTools(server: McpServer, env: Env, actor: Actor): void {
  const svc = () => new ImageService(env.IMAGES);

  // ---- Read ----
  server.tool(
    "images_list",
    "List uploaded images in R2 (paginated via cursor).",
    {
      prefix: z.string().optional(),
      limit: z.number().int().positive().max(1000).optional(),
      cursor: z.string().optional(),
    },
    async (args) => jsonContent(await svc().list(args.prefix, args.limit, args.cursor))
  );

  if (!actor.canWrite) return;

  // ---- Writes ----
  server.tool(
    "image_upload",
    "Upload an image to R2 from base64 data. Returns the public path (served by the main app at /images/...).",
    {
      image_base64: z.string().min(1, "base64 image data required"),
      content_type: z.enum(
        Object.keys(CONTENT_TYPES) as [keyof typeof CONTENT_TYPES, ...(keyof typeof CONTENT_TYPES)[]]
      ),
      folder: z.enum(["faq", "glossary"]),
      filename: z.string().max(200).optional(),
    },
    async (args) => {
      // Strip any data URL prefix, then decode.
      const b64 = args.image_base64.replace(/^data:[^;]+;base64,/, "");
      let bytes: Uint8Array;
      try {
        const binary = atob(b64);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      } catch {
        return errorContent("image_base64 is not valid base64.");
      }
      if (bytes.byteLength === 0) return errorContent("Decoded image is empty.");
      if (bytes.byteLength > MAX_BYTES) {
        return errorContent(`Image is ${bytes.byteLength} bytes; max is ${MAX_BYTES}.`);
      }

      const ext = CONTENT_TYPES[args.content_type];
      const filename = args.filename || `upload.${ext}`;
      const path = ImageService.generatePath(filename, args.folder);
      const blob = new Blob([bytes], { type: args.content_type });
      const publicPath = await svc().upload(blob, path, args.content_type);
      return jsonContent({ path: publicPath, bytes: bytes.byteLength, uploadedBy: actor.email });
    }
  );

  server.tool(
    "image_delete",
    "Delete an image from R2 by its key (e.g. 'images/faq/...').",
    { key: z.string().min(1) },
    async (args) => {
      await svc().delete(args.key);
      return jsonContent({ success: true, deletedKey: args.key });
    }
  );
}
