import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../src/utils/sanitize';

describe('sanitizeHtml', () => {
  it('preserves normal HTML', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('strips script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    expect(sanitizeHtml(input)).toBe('<p>Hello</p><p>World</p>');
  });

  it('strips iframe tags', () => {
    const input = '<p>Before</p><iframe src="evil.com"></iframe><p>After</p>';
    expect(sanitizeHtml(input)).toBe('<p>Before</p><p>After</p>');
  });

  it('strips event handler attributes', () => {
    const input = '<img src="photo.jpg" onerror="alert(1)">';
    expect(sanitizeHtml(input)).toBe('<img src="photo.jpg">');
  });

  it('strips javascript: URLs in href', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    expect(sanitizeHtml(input)).toContain('href="#"');
  });

  it('preserves safe links', () => {
    const input = '<a href="/faq/park-hours">Park Hours</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('strips form-related elements', () => {
    const input = '<form action="/steal"><input type="text"><button>Submit</button></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<button');
  });
});
