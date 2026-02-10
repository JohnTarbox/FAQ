import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { Layout } from '../components/Layout';
import { sanitizeHtml } from '../utils/sanitize';

interface FaqDetailProps {
  question: string;
  answer: string;
  slug: string;
  category?: { name: string; slug: string } | null;
  tags: Array<{ name: string; slug: string }>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export const FaqDetailPage: FC<FaqDetailProps> = ({ question, answer, slug, category, tags }) => {
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'FAQ', item: '/faq' },
      ...(category ? [{ '@type': 'ListItem', position: 3, name: category.name, item: `/faq?category=${category.slug}` }] : []),
      { '@type': 'ListItem', position: category ? 4 : 3, name: question },
    ],
  };

  // Sanitize CMS content before rendering
  const safeAnswer = sanitizeHtml(answer);

  return (
    <Layout title={question} description={stripHtml(answer).substring(0, 160)} jsonLd={breadcrumbLd}>
      <nav class="breadcrumb">
        <a href="/">Home</a> <span>›</span> <a href="/faq">FAQ</a>
        {category && <><span>›</span> <a href={`/faq?category=${category.slug}`}>{category.name}</a></>}
        <span>›</span> {question.substring(0, 40)}…
      </nav>

      <div class="faq-detail" style="padding:16px 0 64px">
        <h1>{question}</h1>

        <div style="display:flex;gap:8px;margin-bottom:28px;flex-wrap:wrap">
          {category && <span class="pill-sm pill-category">{category.name}</span>}
          {tags.map(tag => <span class="pill-sm pill-tag">{tag.name}</span>)}
        </div>

        <div class="answer">{raw(safeAnswer)}</div>

        <a href="/faq" class="back-link">← Back to all FAQs</a>
      </div>
    </Layout>
  );
};
