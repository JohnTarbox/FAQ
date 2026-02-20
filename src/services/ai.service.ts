import type { Ai } from '@cloudflare/workers-types';

interface AiSuggestion {
  question: string;
  answer: string;
  confidence: number;
  category?: string;
  tags?: string[];
}

export class AiService {
  private ai: Ai;

  constructor(ai: Ai) {
    this.ai = ai;
  }

  async generateSuggestions(source: {
    title: string;
    content: string;
    url: string;
    sourceType: string;
  }): Promise<AiSuggestion[]> {
    const existingQuestions = await this.getExistingQuestionsList();
    const prompt = this.buildPrompt(source.content, source.title, existingQuestions);

    try {
      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct' as any, {
        messages: [
          { role: 'system', content: 'You are an expert FAQ writer for APRS (Automatic Packet Reporting System) amateur radio topics. Generate FAQ Q&A pairs from source content. Always respond with valid JSON only, no markdown formatting.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2048,
      }) as { response?: string };

      if (!response?.response) return [];

      return this.parseResponse(response.response);
    } catch (err) {
      console.error('AI generation failed:', err);
      return [];
    }
  }

  private buildPrompt(content: string, title: string, existingQuestions: string[]): string {
    const truncatedContent = content.slice(0, 3000);
    const existingList = existingQuestions.length > 0
      ? `\n\nExisting FAQ questions (DO NOT duplicate these):\n${existingQuestions.map(q => `- ${q}`).join('\n')}`
      : '';

    return `Analyze the following content about APRS and generate 1-5 FAQ question-answer pairs.

Source title: ${title}
Content:
${truncatedContent}
${existingList}

Respond with ONLY a JSON array (no markdown, no code fences). Each item must have:
- "question": a clear, specific question
- "answer": an informative HTML answer (use <p>, <ul>, <li>, <strong> tags)
- "confidence": 0-100 score for how useful this FAQ would be
- "category": suggested category name (e.g., "Getting Started", "Equipment", "Software", "Networks")
- "tags": array of relevant tag strings

Example format:
[{"question":"What is...","answer":"<p>...</p>","confidence":85,"category":"Getting Started","tags":["basics"]}]`;
  }

  private parseResponse(text: string): AiSuggestion[] {
    try {
      // Strip any markdown code fences the model might add despite instructions
      const cleaned = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();

      // Try to find a JSON array in the response
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!arrayMatch) return [];

      const parsed = JSON.parse(arrayMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item: any) => item.question && item.answer)
        .map((item: any) => ({
          question: String(item.question).trim(),
          answer: String(item.answer).trim(),
          confidence: Math.min(100, Math.max(0, Number(item.confidence) || 50)),
          category: item.category ? String(item.category) : undefined,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
        }));
    } catch {
      console.error('Failed to parse AI response:', text.slice(0, 200));
      return [];
    }
  }

  /**
   * Filter out suggestions that are too similar to existing published FAQs.
   * Uses word-set Jaccard similarity — if >70% overlap, consider it a duplicate.
   */
  deduplicateAgainstExisting(
    suggestions: AiSuggestion[],
    existingQuestions: string[],
  ): AiSuggestion[] {
    if (existingQuestions.length === 0) return suggestions;

    const existingSets = existingQuestions.map(q => this.wordSet(q));

    return suggestions.filter(suggestion => {
      const suggestionSet = this.wordSet(suggestion.question);
      return !existingSets.some(existingSet =>
        this.jaccardSimilarity(suggestionSet, existingSet) > 0.7
      );
    });
  }

  private wordSet(text: string): Set<string> {
    return new Set(
      text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
    );
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  // Placeholder — the caller will provide existing questions
  private async getExistingQuestionsList(): Promise<string[]> {
    return [];
  }
}
