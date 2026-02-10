import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { Layout } from '../components/Layout';
import { sanitizeHtml } from '../utils/sanitize';

interface GlossaryDetailProps {
  term: string;
  slug: string;
  shortDefinition: string;
  longDefinition?: string | null;
  abbreviation?: string | null;
  acronymExpansion?: string | null;
  exampleUsage?: string | null;
  relatedTerms: Array<{ term: string; slug: string }>;
  category?: { name: string; slug: string } | null;
}

export const GlossaryDetailPage: FC<GlossaryDetailProps> = (props) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: props.term,
    description: props.shortDefinition,
    inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'State Fair Glossary', url: '/glossary' },
  };

  // Sanitize CMS-authored HTML content before rendering
  const safeLongDef = props.longDefinition ? sanitizeHtml(props.longDefinition) : null;
  const safeExample = props.exampleUsage ? sanitizeHtml(props.exampleUsage) : null;

  return (
    <Layout title={props.term} description={props.shortDefinition} jsonLd={jsonLd}>
      <nav class="breadcrumb">
        <a href="/">Home</a> <span>›</span> <a href="/glossary">Glossary</a> <span>›</span> {props.term}
      </nav>

      <div style="max-width:720px;padding:16px 0 64px">
        <h1 style="font-family:var(--font-display);font-size:36px;font-weight:700;margin-bottom:4px">{props.term}</h1>

        {props.acronymExpansion && (
          <div style="font-family:var(--font-ui);font-size:15px;color:var(--color-ink-muted);font-style:italic;margin-bottom:16px">
            {props.acronymExpansion}
          </div>
        )}

        <div class="short-def-box">{props.shortDefinition}</div>

        {safeLongDef && (
          <div style="font-size:17px;line-height:1.75">{raw(safeLongDef)}</div>
        )}

        {safeExample && (
          <div class="example-usage">{raw(safeExample)}</div>
        )}

        {props.relatedTerms.length > 0 && (
          <div>
            <div style="font-family:var(--font-ui);font-size:13px;font-weight:600;color:var(--color-ink-light);margin:24px 0 10px">Related Terms</div>
            <div class="related-terms">
              {props.relatedTerms.map(rt => (
                <a href={`/glossary/${rt.slug}`} class="chip">{rt.term}</a>
              ))}
            </div>
          </div>
        )}

        <a href="/glossary" class="back-link" style="margin-top:32px">← Back to Glossary</a>
      </div>
    </Layout>
  );
};
