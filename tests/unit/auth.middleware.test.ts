import { describe, it, expect } from 'vitest';
import { resolveRole, hasMinRole } from '../../src/middleware/auth';

describe('Auth middleware — role resolution', () => {
  it('resolves CMS-Admins group to admin role', () => {
    expect(resolveRole(['CMS-Admins', 'CMS-Reviewers'])).toBe('admin');
  });

  it('resolves CMS-Reviewers group to reviewer role', () => {
    expect(resolveRole(['CMS-Reviewers'])).toBe('reviewer');
  });

  it('resolves CMS-Authors or empty groups to author role', () => {
    expect(resolveRole(['CMS-Authors'])).toBe('author');
    expect(resolveRole([])).toBe('author');
  });

  it('admin has highest precedence even with other groups', () => {
    expect(resolveRole(['CMS-Authors', 'CMS-Admins', 'CMS-Reviewers'])).toBe('admin');
  });
});

describe('Auth middleware — role hierarchy', () => {
  it('admin has min role of admin', () => {
    expect(hasMinRole('admin', 'admin')).toBe(true);
  });

  it('admin has min role of reviewer', () => {
    expect(hasMinRole('admin', 'reviewer')).toBe(true);
  });

  it('admin has min role of author', () => {
    expect(hasMinRole('admin', 'author')).toBe(true);
  });

  it('reviewer has min role of reviewer', () => {
    expect(hasMinRole('reviewer', 'reviewer')).toBe(true);
  });

  it('reviewer has min role of author', () => {
    expect(hasMinRole('reviewer', 'author')).toBe(true);
  });

  it('reviewer does NOT have min role of admin', () => {
    expect(hasMinRole('reviewer', 'admin')).toBe(false);
  });

  it('author only has min role of author', () => {
    expect(hasMinRole('author', 'author')).toBe(true);
    expect(hasMinRole('author', 'reviewer')).toBe(false);
    expect(hasMinRole('author', 'admin')).toBe(false);
  });
});
