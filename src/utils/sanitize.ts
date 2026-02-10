/**
 * Basic HTML sanitizer for CMS content rendered server-side.
 * Strips dangerous tags (script, iframe, object, embed, form) and event handlers.
 * Content originates from our admin CMS (authenticated authors only),
 * but we sanitize as defense-in-depth.
 */
export function sanitizeHtml(html: string): string {
  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe, object, embed, form tags
    .replace(/<\/?(?:iframe|object|embed|form|input|button|select|textarea)\b[^>]*>/gi, '')
    // Remove event handler attributes (on*)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: URLs
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"')
    .replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'src=""');
}
