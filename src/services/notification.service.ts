import { eq, and, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export class NotificationService {
  private db;
  private resendApiKey?: string;

  constructor(d1: D1Database, resendApiKey?: string) {
    this.db = drizzle(d1, { schema });
    this.resendApiKey = resendApiKey;
  }

  async create(data: {
    recipientEmail: string;
    type: string;
    title: string;
    body?: string;
    linkUrl?: string;
  }) {
    const notification = await this.db.insert(schema.notifications).values(data).returning().get();

    // Send email if Resend is configured
    if (this.resendApiKey) {
      await this.sendEmail(data.recipientEmail, data.title, data.body || data.title);
    }

    return notification;
  }

  async listForUser(email: string, unreadOnly = false) {
    const conditions = [eq(schema.notifications.recipientEmail, email)];
    if (unreadOnly) {
      conditions.push(eq(schema.notifications.isRead, false));
    }

    return this.db.select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50)
      .all();
  }

  async markAsRead(id: number, email: string) {
    await this.db.update(schema.notifications)
      .set({ isRead: true })
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.recipientEmail, email)))
      .run();
  }

  async markAllAsRead(email: string) {
    await this.db.update(schema.notifications)
      .set({ isRead: true })
      .where(and(eq(schema.notifications.recipientEmail, email), eq(schema.notifications.isRead, false)))
      .run();
  }

  async getUnreadCount(email: string): Promise<number> {
    const result = await this.db.select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.recipientEmail, email), eq(schema.notifications.isRead, false)))
      .all();
    return result.length;
  }

  private async sendEmail(to: string, subject: string, body: string) {
    if (!this.resendApiKey) return;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Fair CMS <noreply@fair.example.com>',
          to: [to],
          subject,
          text: body,
        }),
      });
    } catch {
      // Email failures should not block the workflow
      console.error(`Failed to send email to ${to}`);
    }
  }
}
