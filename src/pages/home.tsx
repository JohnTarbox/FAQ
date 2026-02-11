import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { Layout } from '../components/Layout';

export const HomePage: FC = () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'APRS Foundation FAQ & Glossary',
    url: 'https://faq.aprs.works/',
    description: 'Answers and definitions for the Automatic Packet Reporting System (APRS).',
  };

  return (
    <Layout title="Home" description="APRS Foundation — FAQ and Glossary for the Automatic Packet Reporting System (APRS)." jsonLd={jsonLd} currentPath="/">
      {raw(`<style>${homeCSS}</style>`)}

      <div class="home-hero">
        <h1>APRS Foundation</h1>
        <p class="home-subtitle">FAQ &amp; Glossary</p>
        <p class="home-description">
          Your reference for frequently asked questions and terminology
          for the Automatic Packet Reporting System (APRS).
        </p>
      </div>

      <div class="home-cards">
        <a href="/faq" class="home-card home-card--rust">
          <div class="home-card-icon">?</div>
          <h2>Frequently Asked Questions</h2>
          <p>Browse answers to common questions about the society, membership, events, and more.</p>
          <span class="home-card-link">Browse FAQ →</span>
        </a>

        <a href="/glossary" class="home-card home-card--sage">
          <div class="home-card-icon">Aa</div>
          <h2>Glossary</h2>
          <p>Definitions of terms, abbreviations, and acronyms you may encounter.</p>
          <span class="home-card-link">Browse Glossary →</span>
        </a>
      </div>
    </Layout>
  );
};

const homeCSS = `
.home-hero{text-align:center;padding:72px 0 48px}
.home-hero h1{font-family:var(--font-display);font-size:48px;font-weight:700;line-height:1.1;margin-bottom:8px}
.home-subtitle{font-family:var(--font-display);font-size:22px;font-weight:400;color:var(--color-rust);margin-bottom:20px}
.home-description{font-size:17px;color:var(--color-ink-light);max-width:480px;margin:0 auto;line-height:1.6}
.home-cards{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:0 0 64px}
.home-card{display:block;background:var(--color-warm-white);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:32px;transition:box-shadow .15s,border-color .15s;text-decoration:none;color:var(--color-ink)}
.home-card:hover{box-shadow:0 2px 8px rgba(26,26,26,.08);border-color:var(--color-border-dark)}
.home-card-icon{width:48px;height:48px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:22px;font-weight:700;margin-bottom:16px}
.home-card--rust .home-card-icon{background:var(--color-rust-pale);color:var(--color-rust)}
.home-card--sage .home-card-icon{background:var(--color-sage-light);color:var(--color-sage)}
.home-card h2{font-family:var(--font-display);font-size:24px;font-weight:600;margin-bottom:8px}
.home-card p{font-size:15px;color:var(--color-ink-light);line-height:1.6;margin-bottom:16px}
.home-card-link{font-family:var(--font-ui);font-size:14px;font-weight:600}
.home-card--rust .home-card-link{color:var(--color-rust)}
.home-card--sage .home-card-link{color:var(--color-sage)}
.home-card--rust:hover{border-color:var(--color-rust-light)}
.home-card--sage:hover{border-color:var(--color-sage)}
@media(max-width:768px){.home-hero h1{font-size:36px}.home-cards{grid-template-columns:1fr}}
`;
