import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { FaqService } from '../services/faq.service';
import { GlossaryService } from '../services/glossary.service';
import { FaqIndexPage } from './faq-index';
import { FaqDetailPage } from './faq-detail';
import { GlossaryIndexPage } from './glossary-index';
import { GlossaryDetailPage } from './glossary-detail';

export const pageRoutes = new Hono<AppEnv>();

// Public FAQ index page
pageRoutes.get('/faq', async (c) => {
  const faqSvc = new FaqService(c.env.DB);
  const page = Number(c.req.query('page')) || 1;
  const category = c.req.query('category');

  const result = await faqSvc.listPublished({ categorySlug: category, page });

  const categoriesResult = await c.env.DB.prepare(
    'SELECT name, slug FROM faq_categories ORDER BY sort_order, name'
  ).all();

  return c.html(
    <FaqIndexPage
      faqs={result.items as any}
      categories={(categoriesResult.results || []) as any}
      currentCategory={category}
      page={page}
      totalPages={result.totalPages}
    />
  );
});

// Public FAQ detail page
pageRoutes.get('/faq/:slug', async (c) => {
  const slug = c.req.param('slug');
  const faqSvc = new FaqService(c.env.DB);
  const faq = await faqSvc.getBySlug(slug);

  if (!faq) return c.text('FAQ not found', 404);

  return c.html(
    <FaqDetailPage
      question={faq.question}
      answer={faq.answer}
      slug={slug}
      category={faq.category}
      tags={faq.tags}
    />
  );
});

// Public Glossary index page
pageRoutes.get('/glossary', async (c) => {
  const glossarySvc = new GlossaryService(c.env.DB);
  const terms = await glossarySvc.listPublished();

  return c.html(
    <GlossaryIndexPage terms={terms as any} />
  );
});

// Public Glossary detail page
pageRoutes.get('/glossary/:slug', async (c) => {
  const slug = c.req.param('slug');
  const glossarySvc = new GlossaryService(c.env.DB);
  const term = await glossarySvc.getBySlug(slug);

  if (!term) return c.text('Term not found', 404);

  return c.html(
    <GlossaryDetailPage
      term={term.term}
      slug={term.slug}
      shortDefinition={term.shortDefinition}
      longDefinition={term.longDefinition}
      abbreviation={term.abbreviation}
      acronymExpansion={term.acronymExpansion}
      exampleUsage={term.exampleUsage}
      relatedTerms={term.relatedTerms}
      category={term.category}
    />
  );
});
