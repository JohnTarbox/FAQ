import type { FC, PropsWithChildren } from 'hono/jsx';
import { raw } from 'hono/html';

export const Layout: FC<PropsWithChildren<{ title: string; description?: string; jsonLd?: object }>> = ({ title, description, jsonLd, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — State Fair FAQ &amp; Glossary</title>
      {description && <meta name="description" content={description} />}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Source+Serif+4:opsz,wght@8..60,400..700&family=DM+Sans:wght@300..700&display=swap" rel="stylesheet" />
      {raw(`<style>${publicCSS}</style>`)}
      {jsonLd && raw(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`)}
    </head>
    <body>
      <div class="public-container">
        {children}
      </div>
      <script src="/glossary/widget.js" defer />
    </body>
  </html>
);

const publicCSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --color-cream:#FAF7F2;--color-warm-white:#FFFFFF;--color-ink:#1A1A1A;
  --color-ink-light:#4A4A4A;--color-ink-muted:#8A8A8A;
  --color-rust:#B5451B;--color-rust-light:#D4713A;--color-rust-pale:#FDF0E9;
  --color-sage:#5B7B5E;--color-sage-light:#E8F0E8;
  --color-gold:#C4962C;--color-gold-pale:#FEF9EE;
  --color-border:#E5E0D8;--color-border-dark:#C8C2B8;
  --font-display:'Fraunces',serif;--font-body:'Source Serif 4',serif;
  --font-ui:'DM Sans',sans-serif;
  --radius-sm:4px;--radius-md:8px;--radius-lg:12px;
}
body{font-family:var(--font-body);color:var(--color-ink);background:var(--color-cream);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--color-rust);text-decoration:none}a:hover{color:var(--color-rust-light)}
.public-container{max-width:960px;margin:0 auto;padding:0 24px}
.breadcrumb{font-family:var(--font-ui);font-size:13px;color:var(--color-ink-muted);padding:16px 0}
.breadcrumb a{color:var(--color-ink-muted)}.breadcrumb a:hover{color:var(--color-rust)}
.breadcrumb span{margin:0 6px}
.hero{padding:48px 0 36px}
.hero h1{font-family:var(--font-display);font-size:42px;font-weight:700;line-height:1.15;margin-bottom:20px}
.search-bar{position:relative;max-width:560px}
.search-bar input{width:100%;padding:14px 18px 14px 48px;font-family:var(--font-ui);font-size:15px;border:2px solid var(--color-border);border-radius:var(--radius-lg);background:var(--color-warm-white)}
.search-bar input:focus{outline:none;border-color:var(--color-rust)}
.search-bar .search-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--color-ink-muted)}
.pill{display:inline-block;padding:6px 16px;font-family:var(--font-ui);font-size:13px;font-weight:500;border-radius:100px;border:1.5px solid var(--color-border);background:var(--color-warm-white);color:var(--color-ink-light)}
.pill.active{background:var(--color-rust);border-color:var(--color-rust);color:#fff}
.pill-sm{padding:3px 10px;font-size:11px;font-weight:500;font-family:var(--font-ui);border-radius:100px;display:inline-block}
.pill-category{background:var(--color-rust-pale);color:var(--color-rust)}
.pill-tag{background:var(--color-sage-light);color:var(--color-sage)}
.faq-card{background:var(--color-warm-white);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:20px 24px;margin-bottom:12px;transition:box-shadow .15s}
.faq-card:hover{box-shadow:0 1px 3px rgba(26,26,26,.06)}
.faq-card.featured{background:var(--color-gold-pale);border-left:4px solid var(--color-gold)}
.faq-card .question{font-family:var(--font-display);font-size:18px;font-weight:600;margin-bottom:6px}
.faq-card .question a{color:var(--color-ink)}.faq-card .question a:hover{color:var(--color-rust)}
.faq-card .preview{font-size:15px;color:var(--color-ink-light);margin-bottom:10px}
.faq-card .meta{display:flex;gap:12px;font-family:var(--font-ui);font-size:12px;color:var(--color-ink-muted);align-items:center}
.faq-detail h1{font-family:var(--font-display);font-size:36px;font-weight:700;margin-bottom:12px}
.faq-detail .answer{font-size:17px;line-height:1.75}
.faq-detail .answer p{margin-bottom:16px}
.faq-detail .answer ul,.faq-detail .answer ol{margin:12px 0 16px 24px}
.faq-detail .answer li{margin-bottom:6px}
.az-bar{display:flex;flex-wrap:wrap;gap:4px;padding:16px 0;position:sticky;top:0;z-index:100;background:var(--color-cream);border-bottom:1px solid var(--color-border);margin-bottom:24px}
.az-bar a{width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-family:var(--font-ui);font-size:13px;font-weight:600;color:var(--color-ink-light);border-radius:var(--radius-sm)}
.az-bar a:hover{background:var(--color-rust-pale);color:var(--color-rust)}
.az-bar a.active{background:var(--color-rust);color:#fff}
.az-bar a.dimmed{color:var(--color-ink-muted);opacity:.4;pointer-events:none}
.glossary-group{margin-bottom:36px}
.glossary-group h2{font-family:var(--font-display);font-size:32px;font-weight:700;padding-bottom:8px;border-bottom:2px solid var(--color-border);margin-bottom:16px}
.glossary-group dt{font-family:var(--font-ui);font-size:16px;font-weight:600;margin-bottom:4px}
.glossary-group dd{font-size:15px;color:var(--color-ink-light);line-height:1.6;margin-bottom:20px}
.short-def-box{background:var(--color-sage-light);border-left:4px solid var(--color-sage);padding:16px 20px;border-radius:0 var(--radius-md) var(--radius-md) 0;font-size:17px;line-height:1.6;margin-bottom:24px}
.example-usage{background:var(--color-cream);border-left:3px solid var(--color-gold);padding:16px 20px;margin:20px 0;font-style:italic;color:var(--color-ink-light)}
.related-terms{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.chip{display:inline-block;padding:5px 14px;font-family:var(--font-ui);font-size:13px;font-weight:500;border:1.5px solid var(--color-border);border-radius:100px;color:var(--color-ink-light)}
.chip:hover{border-color:var(--color-rust);color:var(--color-rust)}
.pagination{display:flex;align-items:center;justify-content:center;gap:4px;padding:32px 0;font-family:var(--font-ui);font-size:14px}
.pagination a,.pagination span{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid var(--color-border);border-radius:var(--radius-sm);background:var(--color-warm-white);color:var(--color-ink-light)}
.pagination a:hover{border-color:var(--color-rust);color:var(--color-rust)}
.pagination .active{background:var(--color-rust);border-color:var(--color-rust);color:#fff}
.back-link{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-ui);font-size:14px;font-weight:500;margin-top:32px}
@media(max-width:768px){.hero h1{font-size:32px}}
`;
