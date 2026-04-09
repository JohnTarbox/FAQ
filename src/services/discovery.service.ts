import type { Ai } from '@cloudflare/workers-types';
import { eq, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { AiService } from './ai.service';
import { SuggestionService } from './suggestion.service';
import { NotificationService } from './notification.service';
import type { Env } from '../env';
import type { DiscoveryLogEntry } from '../db/schema';
import * as schema from '../db/schema';

interface DiscoveredSource {
  url: string;
  title: string;
  snippet: string;
  sourceType: 'web' | 'youtube' | 'site';
}

const MAX_SOURCES_PER_RUN = 10;
const AI_TIMEOUT_MS = 30_000;    // 30s per AI generation call
const RUN_DEADLINE_MS = 120_000; // 2 min total run budget

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export class DiscoveryService {
  private env: Env;
  private suggestionService: SuggestionService;
  private aiService: AiService;

  constructor(env: Env) {
    this.env = env;
    this.suggestionService = new SuggestionService(env.DB);
    this.aiService = new AiService(env.AI);
  }

  private async log(runId: number, level: DiscoveryLogEntry['level'], message: string, detail?: string) {
    await this.suggestionService.appendLog(runId, {
      timestamp: new Date().toISOString(),
      level,
      message,
      detail,
    });
  }

  async runDiscovery(
    triggeredBy: string,
    triggerType: 'manual' | 'cron',
    existingRun?: { id: number },
    existingBatchId?: string,
  ) {
    const batchId = existingBatchId || `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const run = existingRun || await this.suggestionService.createRun(triggeredBy, triggerType, batchId);

    // Race the actual work against a deadline so the run always gets finalized
    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Run exceeded deadline of 120s')), RUN_DEADLINE_MS)
    );

    try {
      await Promise.race([this._executeRun(run, batchId), deadline]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // Use .catch() to prevent secondary failures from masking the original error
      await this.log(run.id, 'error', 'Run failed', errorMsg).catch(() => {});
      await this.suggestionService.failRun(run.id, errorMsg).catch(() => {});
    }

    return run;
  }

  private async _executeRun(run: { id: number }, batchId: string) {
    let sourcesChecked = 0;
    let suggestionsCreated = 0;
    const errors: string[] = [];

    await this.log(run.id, 'info', 'Discovery run started');

    // Log API key warnings
    if (!this.env.YOUTUBE_API_KEY) {
      await this.log(run.id, 'warn', 'YouTube API key not configured — YouTube searches will be skipped');
    }
    if (!this.env.GOOGLE_SEARCH_API_KEY || !this.env.GOOGLE_SEARCH_CX_ID) {
      await this.log(run.id, 'warn', 'Google Search API key or CX ID not configured — web searches will be skipped');
    }

    // 1. Load active search terms
    const terms = await this.suggestionService.getActiveSearchTerms();
    if (terms.length === 0) {
      await this.log(run.id, 'warn', 'No active search terms configured');
      await this.suggestionService.completeRun(run.id, 0, 0);
      return;
    }

    await this.log(run.id, 'info', `Loaded ${terms.length} active search term${terms.length === 1 ? '' : 's'}`);

    // 2. Discover content from all sources
    const allSources: DiscoveredSource[] = [];

    for (const term of terms) {
      const sourceTypes: string[] = JSON.parse(term.sourceTypes || '["web","youtube","site"]');

      if (sourceTypes.includes('youtube') && this.env.YOUTUBE_API_KEY) {
        try {
          await this.log(run.id, 'info', `Searching YouTube for "${term.term}"...`);
          const ytResults = await this.searchYouTube(term.term);
          await this.log(run.id, 'info', `YouTube: found ${ytResults.length} results for "${term.term}"`);
          allSources.push(...ytResults);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          errors.push(`YouTube search for "${term.term}": ${detail}`);
          await this.log(run.id, 'error', `YouTube search failed for "${term.term}"`, detail);
        }
      }

      if (sourceTypes.includes('web') && this.env.GOOGLE_SEARCH_API_KEY && this.env.GOOGLE_SEARCH_CX_ID) {
        try {
          await this.log(run.id, 'info', `Searching Google for "${term.term}"...`);
          const googleResults = await this.searchGoogle(term.term);
          await this.log(run.id, 'info', `Google: found ${googleResults.length} results for "${term.term}"`);
          allSources.push(...googleResults);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          errors.push(`Google search for "${term.term}": ${detail}`);
          await this.log(run.id, 'error', `Google search failed for "${term.term}"`, detail);
        }
      }
    }

    // 3. Load known sites from DB
    const knownSites = await this.suggestionService.getActiveKnownSites();
    await this.log(run.id, 'info', `Loaded ${knownSites.length} known site${knownSites.length === 1 ? '' : 's'}`);

    for (const site of knownSites) {
      allSources.push({
        url: site.url,
        title: site.title || new URL(site.url).hostname,
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

    const alreadyProcessed = allSources.length - newSources.length;
    await this.log(run.id, 'info', `Found ${newSources.length} new sources (${alreadyProcessed} already processed)`);

    // 5. Fetch existing FAQ questions for dedup
    const existingQuestions = await this.getPublishedQuestions();

    // 6. Process each new source through AI
    for (const source of newSources) {
      sourcesChecked++;
      try {
        await this.log(run.id, 'info', `Processing source: "${source.title}" (${source.url})`);

        // For sites, fetch actual content
        let content = source.snippet;
        if (source.sourceType === 'site' && !content) {
          content = await this.fetchSiteContent(source.url);
        }

        if (!content || content.length < 50) {
          await this.log(run.id, 'info', `Source skipped: content too short`);
          await this.suggestionService.markProcessed(source.url, source.sourceType, source.title, 0, batchId);
          continue;
        }

        // Generate suggestions via AI (with timeout guard)
        await this.log(run.id, 'info', 'Generating AI suggestions...');
        const aiSuggestions = await withTimeout(
          this.aiService.generateSuggestions({
            title: source.title,
            content,
            url: source.url,
            sourceType: source.sourceType,
          }),
          AI_TIMEOUT_MS,
          'AI generation',
        );

        // Deduplicate against existing FAQs
        const unique = this.aiService.deduplicateAgainstExisting(aiSuggestions, existingQuestions);

        if (unique.length === 0) {
          await this.log(run.id, 'warn', `AI generated 0 suggestions from "${source.title}"`);
        } else {
          await this.log(run.id, 'info', `AI generated ${unique.length} suggestion${unique.length === 1 ? '' : 's'}`);
        }

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

        // Update progress counters so polling can display them
        await this.suggestionService.updateRunProgress(run.id, sourcesChecked, suggestionsCreated);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        errors.push(`Processing ${source.url}: ${detail}`);
        await this.log(run.id, 'error', `Failed to process "${source.title}"`, detail);
      }
    }

    // 7. Complete the run
    await this.log(run.id, 'info', `Run completed: ${sourcesChecked} sources checked, ${suggestionsCreated} suggestions created`);
    await this.suggestionService.completeRun(
      run.id,
      sourcesChecked,
      suggestionsCreated,
      errors.length > 0 ? JSON.stringify(errors) : undefined,
    );

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
    const db = drizzle(this.env.DB);
    const results = await db.select({ question: schema.faqVersions.question })
      .from(schema.faqEntries)
      .innerJoin(schema.faqVersions, eq(schema.faqEntries.liveVersionId, schema.faqVersions.id))
      .where(isNotNull(schema.faqEntries.liveVersionId))
      .all();

    return results.map(r => r.question);
  }
}
