import type { Ai } from '@cloudflare/workers-types';
import { AiService } from './ai.service';
import { SuggestionService } from './suggestion.service';
import { NotificationService } from './notification.service';
import type { Env } from '../env';

interface DiscoveredSource {
  url: string;
  title: string;
  snippet: string;
  sourceType: 'web' | 'youtube' | 'site';
}

const KNOWN_APRS_SITES = [
  'http://www.aprs.org',
  'https://aprs.fi',
  'https://www.arrl.org/aprs',
  'https://aprsdirect.com',
];

const MAX_SOURCES_PER_RUN = 10;

export class DiscoveryService {
  private env: Env;
  private suggestionService: SuggestionService;
  private aiService: AiService;

  constructor(env: Env) {
    this.env = env;
    this.suggestionService = new SuggestionService(env.DB);
    this.aiService = new AiService(env.AI);
  }

  async runDiscovery(triggeredBy: string, triggerType: 'manual' | 'cron') {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const run = await this.suggestionService.createRun(triggeredBy, triggerType, batchId);

    let sourcesChecked = 0;
    let suggestionsCreated = 0;
    const errors: string[] = [];

    try {
      // 1. Load active search terms
      const terms = await this.suggestionService.getActiveSearchTerms();
      if (terms.length === 0) {
        await this.suggestionService.completeRun(run.id, 0, 0);
        return run;
      }

      // 2. Discover content from all sources
      const allSources: DiscoveredSource[] = [];

      for (const term of terms) {
        const sourceTypes: string[] = JSON.parse(term.sourceTypes || '["web","youtube","site"]');

        try {
          if (sourceTypes.includes('youtube') && this.env.YOUTUBE_API_KEY) {
            const ytResults = await this.searchYouTube(term.term);
            allSources.push(...ytResults);
          }
        } catch (err) {
          errors.push(`YouTube search for "${term.term}": ${err}`);
        }

        try {
          if (sourceTypes.includes('web') && this.env.GOOGLE_SEARCH_API_KEY && this.env.GOOGLE_SEARCH_CX_ID) {
            const googleResults = await this.searchGoogle(term.term);
            allSources.push(...googleResults);
          }
        } catch (err) {
          errors.push(`Google search for "${term.term}": ${err}`);
        }
      }

      // 3. Add known APRS sites
      for (const siteUrl of KNOWN_APRS_SITES) {
        allSources.push({
          url: siteUrl,
          title: new URL(siteUrl).hostname,
          snippet: '',
          sourceType: 'site',
        });
      }

      // 4. Deduplicate against already-processed URLs
      const newSources: DiscoveredSource[] = [];
      for (const source of allSources) {
        if (newSources.length >= MAX_SOURCES_PER_RUN) break;
        const processed = await this.suggestionService.isAlreadyProcessed(source.url);
        if (!processed) {
          newSources.push(source);
        }
      }

      // 5. Fetch existing FAQ questions for dedup
      const existingQuestions = await this.getPublishedQuestions();

      // 6. Process each new source through AI
      for (const source of newSources) {
        sourcesChecked++;
        try {
          // For sites, fetch actual content
          let content = source.snippet;
          if (source.sourceType === 'site' && !content) {
            content = await this.fetchSiteContent(source.url);
          }

          if (!content || content.length < 50) {
            await this.suggestionService.markProcessed(source.url, source.sourceType, source.title, 0, batchId);
            continue;
          }

          // Generate suggestions via AI
          const aiSuggestions = await this.aiService.generateSuggestions({
            title: source.title,
            content,
            url: source.url,
            sourceType: source.sourceType,
          });

          // Deduplicate against existing FAQs
          const unique = this.aiService.deduplicateAgainstExisting(aiSuggestions, existingQuestions);

          // Store suggestions
          for (const suggestion of unique) {
            await this.suggestionService.createFromAi({
              question: suggestion.question,
              answer: suggestion.answer,
              sourceUrl: source.url,
              sourceTitle: source.title,
              sourceType: source.sourceType,
              sourceSnippet: content.slice(0, 500),
              confidenceScore: suggestion.confidence,
              suggestedCategory: suggestion.category,
              suggestedTags: suggestion.tags ? JSON.stringify(suggestion.tags) : undefined,
              searchKeywords: suggestion.tags?.join(', '),
              batchId,
            });
            suggestionsCreated++;
          }

          await this.suggestionService.markProcessed(source.url, source.sourceType, source.title, unique.length, batchId);
        } catch (err) {
          errors.push(`Processing ${source.url}: ${err}`);
        }
      }

      // 7. Complete the run
      await this.suggestionService.completeRun(run.id, sourcesChecked, suggestionsCreated);

      // 8. Notify admins if suggestions were created
      if (suggestionsCreated > 0) {
        try {
          const notif = new NotificationService(this.env.DB, this.env.RESEND_API_KEY);
          await notif.create({
            recipientEmail: 'admins@aprs.works',
            type: 'ai_suggestions',
            title: `${suggestionsCreated} new AI suggestions`,
            body: `Discovery run completed: ${sourcesChecked} sources checked, ${suggestionsCreated} suggestions generated.`,
            linkUrl: '/admin/suggestions',
          });
        } catch {
          // Notification failure shouldn't fail the run
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.suggestionService.failRun(run.id, errorMsg);
    }

    return run;
  }

  async searchYouTube(term: string): Promise<DiscoveredSource[]> {
    if (!this.env.YOUTUBE_API_KEY) return [];

    const params = new URLSearchParams({
      part: 'snippet',
      q: term,
      type: 'video',
      maxResults: '5',
      key: this.env.YOUTUBE_API_KEY,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

    const data = await res.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: { title: string; description: string };
      }>;
    };

    return (data.items || []).map(item => ({
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      title: item.snippet.title,
      snippet: item.snippet.description,
      sourceType: 'youtube' as const,
    }));
  }

  async searchGoogle(term: string): Promise<DiscoveredSource[]> {
    if (!this.env.GOOGLE_SEARCH_API_KEY || !this.env.GOOGLE_SEARCH_CX_ID) return [];

    const params = new URLSearchParams({
      q: `${term} APRS amateur radio`,
      key: this.env.GOOGLE_SEARCH_API_KEY,
      cx: this.env.GOOGLE_SEARCH_CX_ID,
      num: '5',
    });

    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!res.ok) throw new Error(`Google Search API error: ${res.status}`);

    const data = await res.json() as {
      items?: Array<{
        link: string;
        title: string;
        snippet: string;
      }>;
    };

    return (data.items || []).map(item => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      sourceType: 'web' as const,
    }));
  }

  async fetchSiteContent(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'APRS-FAQ-Bot/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return '';

      const html = await res.text();

      // Basic HTML-to-text extraction: strip tags, collapse whitespace
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return text.slice(0, 5000);
    } catch {
      return '';
    }
  }

  private async getPublishedQuestions(): Promise<string[]> {
    // Direct query for efficiency — get all published FAQ questions
    const results = await this.env.DB.prepare(
      `SELECT fv.question FROM faq_entries fe
       INNER JOIN faq_versions fv ON fe.live_version_id = fv.id
       WHERE fe.live_version_id IS NOT NULL`
    ).all<{ question: string }>();

    return results.results.map(r => r.question);
  }
}
