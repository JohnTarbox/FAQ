import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { FaqService } from '../../src/services/faq.service';
import { runMigrations, seedFaqData } from '../helpers/setup';

describe('FAQ Approval Workflow', () => {
  let svc: FaqService;
  let entryId: number;
  let v1Id: number;
  let v2Id: number;
  let categoryId: number;

  beforeAll(async () => {
    await runMigrations();
    await seedFaqData();
    svc = new FaqService(env.DB);

    // Get the seeded category ID (may not be 1 if other tests ran first)
    const cat = await env.DB.prepare("SELECT id FROM faq_categories WHERE slug = 'tickets-pricing'").first<{ id: number }>();
    categoryId = cat!.id;
  });

  it('creates a new FAQ as draft with version 1', async () => {
    const result = await svc.create({
      question: 'What are the park hours?',
      answer: '<p>Open 8am-11pm daily.</p>',
      slug: 'wf-park-hours',
      categoryId,
      authorEmail: 'author@fair.example.com',
    });

    entryId = result.entry.id;
    v1Id = result.version.id;

    expect(result.entry.slug).toBe('wf-park-hours');
    expect(result.version.versionNumber).toBe(1);
    expect(result.version.status).toBe('draft');
    expect(result.version.authorEmail).toBe('author@fair.example.com');
  });

  it('submits a draft for review', async () => {
    const result = await svc.submitForReview(v1Id, 'author@fair.example.com');
    expect(result.status).toBe('pending_review');
  });

  it('rejects submitting a non-draft for review', async () => {
    await expect(svc.submitForReview(v1Id, 'author@fair.example.com'))
      .rejects.toThrow('Only drafts can be submitted for review');
  });

  it('rejects self-approval', async () => {
    await expect(svc.approve(v1Id, 'author@fair.example.com'))
      .rejects.toThrow('Cannot approve your own submission');
  });

  it('allows a different user to approve', async () => {
    const result = await svc.approve(v1Id, 'reviewer@fair.example.com');
    expect(result.status).toBe('published');

    // Check live_version_id is set
    const entry = await svc.getById(entryId);
    expect(entry?.liveVersionId).toBe(v1Id);
  });

  it('serves published FAQ via getBySlug', async () => {
    const faq = await svc.getBySlug('wf-park-hours');
    expect(faq).not.toBeNull();
    expect(faq!.question).toBe('What are the park hours?');
    expect(faq!.answer).toContain('8am-11pm');
  });

  it('creates a new version when editing a published FAQ', async () => {
    const v2 = await svc.createNewVersion(entryId, {
      question: 'What are the park hours for 2025?',
      answer: '<p>Open 8am-midnight in 2025.</p>',
      authorEmail: 'author@fair.example.com',
    });

    v2Id = v2.id;
    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe('draft');
  });

  it('public still sees the old version while new version is draft', async () => {
    const faq = await svc.getBySlug('wf-park-hours');
    expect(faq!.question).toBe('What are the park hours?');
    expect(faq!.answer).toContain('8am-11pm');
  });

  it('approving new version updates the live version', async () => {
    await svc.submitForReview(v2Id, 'author@fair.example.com');
    await svc.approve(v2Id, 'reviewer@fair.example.com');

    const faq = await svc.getBySlug('wf-park-hours');
    expect(faq!.question).toBe('What are the park hours for 2025?');
    expect(faq!.answer).toContain('midnight');
  });

  it('rejection returns version to draft with note', async () => {
    const v3 = await svc.createNewVersion(entryId, {
      question: 'Updated again',
      answer: '<p>Test</p>',
      authorEmail: 'author@fair.example.com',
    });

    await svc.submitForReview(v3.id, 'author@fair.example.com');
    const result = await svc.reject(v3.id, 'reviewer@fair.example.com', 'Needs more detail');
    expect(result.status).toBe('draft');

    // Verify rejection note was saved
    const version = await env.DB.prepare('SELECT rejection_note FROM faq_versions WHERE id = ?').bind(v3.id).first();
    expect(version?.rejection_note).toBe('Needs more detail');
  });

  it('records audit log entries for all transitions', async () => {
    const log = await svc.getAuditLog(entryId);
    expect(log.length).toBeGreaterThanOrEqual(5);

    const actions = log.map(l => l.action);
    expect(actions).toContain('created');
    expect(actions).toContain('submitted');
    expect(actions).toContain('approved');
    expect(actions).toContain('rejected');
  });
});
