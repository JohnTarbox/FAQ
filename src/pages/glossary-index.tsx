import type { FC } from 'hono/jsx';
import { Layout } from '../components/Layout';

interface GlossaryIndexProps {
  terms: Array<{
    id: number;
    term: string;
    slug: string;
    shortDefinition: string;
    abbreviation?: string | null;
    longDefinition?: string | null;
  }>;
}

export const GlossaryIndexPage: FC<GlossaryIndexProps> = ({ terms }) => {
  // Group by first letter
  const groups: Record<string, typeof terms> = {};
  for (const t of terms) {
    const letter = t.term[0].toUpperCase().match(/[A-Z]/) ? t.term[0].toUpperCase() : '#';
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(t);
  }

  const allLetters = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const activeLetters = new Set(Object.keys(groups));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'State Fair Glossary',
    hasDefinedTerm: terms.map(t => ({
      '@type': 'DefinedTerm',
      name: t.term,
      description: t.shortDefinition,
      url: `/glossary/${t.slug}`,
    })),
  };

  return (
    <Layout title="Glossary" description="Definitions of common fair, agricultural, and 4-H terms." jsonLd={jsonLd}>
      <nav class="breadcrumb">
        <a href="/">Home</a> <span>›</span> Glossary
      </nav>

      <div class="hero">
        <h1>Glossary</h1>
        <form class="search-bar" action="/glossary/search" method="get">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" name="q" placeholder="Search glossary terms…" />
        </form>
      </div>

      <div class="az-bar">
        {allLetters.map(letter => (
          activeLetters.has(letter)
            ? <a href={`#letter-${letter}`}>{letter}</a>
            : <a class="dimmed">{letter}</a>
        ))}
      </div>

      {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([letter, letterTerms]) => (
        <div class="glossary-group" id={`letter-${letter}`}>
          <h2>{letter}</h2>
          <dl>
            {letterTerms.map(t => (
              <>
                <dt>
                  <a href={`/glossary/${t.slug}`}>{t.term}</a>
                  {t.abbreviation && <span style="font-weight:400;color:var(--color-ink-muted);font-size:14px;margin-left:6px">({t.abbreviation})</span>}
                </dt>
                <dd>
                  {t.shortDefinition}
                  {t.longDefinition && <a href={`/glossary/${t.slug}`} style="font-family:var(--font-ui);font-size:13px;font-weight:500;margin-left:6px">Read more →</a>}
                </dd>
              </>
            ))}
          </dl>
        </div>
      ))}
    </Layout>
  );
};
