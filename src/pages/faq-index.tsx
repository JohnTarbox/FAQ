import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { Layout } from '../components/Layout';

interface FaqIndexProps {
  faqs: Array<{
    slug: string;
    question: string;
    answer: string;
    isFeatured: boolean;
    updatedAt: string;
    categoryName?: string;
    categorySlug?: string;
  }>;
  categories: Array<{ name: string; slug: string }>;
  currentCategory?: string;
  page: number;
  totalPages: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export const FaqIndexPage: FC<FaqIndexProps> = ({ faqs, categories, currentCategory, page, totalPages }) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer).substring(0, 300) },
    })),
  };

  return (
    <Layout title="Frequently Asked Questions" description="Find answers to common questions about the State Fair." jsonLd={jsonLd}>
      <nav class="breadcrumb">
        <a href="/">Home</a> <span>›</span> FAQ
      </nav>

      <div class="hero">
        <h1>Frequently Asked Questions</h1>
        <form class="search-bar" action="/faq/search" method="get">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" name="q" placeholder="Search questions…" />
        </form>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;padding:24px 0 8px">
        <a href="/faq" class={`pill ${!currentCategory ? 'active' : ''}`}>All</a>
        {categories.map(cat => (
          <a href={`/faq?category=${cat.slug}`} class={`pill ${currentCategory === cat.slug ? 'active' : ''}`}>{cat.name}</a>
        ))}
      </div>

      <div style="padding:24px 0">
        {faqs.map(faq => (
          <div class={`faq-card ${faq.isFeatured ? 'featured' : ''}`}>
            <div class="question"><a href={`/faq/${faq.slug}`}>{faq.question}</a></div>
            <div class="preview">{stripHtml(faq.answer).substring(0, 120)}…</div>
            <div class="meta">
              {faq.isFeatured && <span class="pill-sm" style="background:var(--color-gold-pale);color:var(--color-gold)">Featured</span>}
              {faq.categoryName && <span class="pill-sm pill-category">{faq.categoryName}</span>}
              <span>Updated {faq.updatedAt?.split('T')[0]}</span>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div class="pagination">
          {page > 1 && <a href={`/faq?page=${page - 1}${currentCategory ? `&category=${currentCategory}` : ''}`}>‹</a>}
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <a href={`/faq?page=${p}${currentCategory ? `&category=${currentCategory}` : ''}`} class={p === page ? 'active' : ''}>{String(p)}</a>
          ))}
          {page < totalPages && <a href={`/faq?page=${page + 1}${currentCategory ? `&category=${currentCategory}` : ''}`}>›</a>}
        </div>
      )}
    </Layout>
  );
};
