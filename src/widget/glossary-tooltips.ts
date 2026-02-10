/**
 * Glossary Tooltip Widget — self-contained IIFE
 *
 * Embeds via: <script src="/glossary/widget.js" defer></script>
 *
 * Fetches term index from API, walks DOM to find matches,
 * wraps in interactive spans, shows tooltip on hover/focus.
 * Uses localStorage for caching.
 */

(function glossaryTooltipWidget() {
  const CACHE_KEY = 'glossary-terms-index';
  const CACHE_TTL = 3600000; // 1 hour in ms
  const API_URL = '/api/glossary/terms-index';

  interface TermEntry {
    term: string;
    slug: string;
    shortDefinition: string;
  }

  // Inject namespaced styles
  const style = document.createElement('style');
  style.textContent = [
    '.gt-trigger{border-bottom:1.5px dotted #B5451B;cursor:help;padding-bottom:1px;transition:border-color .15s}',
    '.gt-trigger:hover{border-bottom-color:#D4713A;color:#B5451B}',
    '.gt-tooltip{position:absolute;background:#FAF7F2;border:1px solid #E5E0D8;border-radius:8px;padding:12px 16px;',
    'box-shadow:0 8px 24px rgba(26,26,26,.12);max-width:300px;font-size:14px;line-height:1.5;z-index:10000;',
    "pointer-events:auto;opacity:0;transition:opacity .15s;font-family:'DM Sans',sans-serif}",
    '.gt-tooltip.visible{opacity:1}',
    '.gt-tooltip-term{font-weight:600;font-size:13px;margin-bottom:4px;color:#1A1A1A}',
    '.gt-tooltip-def{color:#4A4A4A;margin-bottom:8px}',
    '.gt-tooltip-link{font-size:12px;font-weight:500;color:#B5451B;text-decoration:none}',
    '.gt-tooltip-link:hover{color:#D4713A}',
    '.gt-tooltip-arrow{position:absolute;width:10px;height:10px;background:#FAF7F2;',
    'border-right:1px solid #E5E0D8;border-bottom:1px solid #E5E0D8;transform:rotate(45deg)}',
  ].join('');
  document.head.appendChild(style);

  let tooltipEl: HTMLDivElement | null = null;
  let arrowEl: HTMLDivElement | null = null;

  function getTooltip(): HTMLDivElement {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'gt-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    arrowEl = document.createElement('div');
    arrowEl.className = 'gt-tooltip-arrow';
    tooltipEl.appendChild(arrowEl);
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function escapeForDisplay(str: string): string {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function showTooltip(trigger: HTMLElement, entry: TermEntry) {
    const tt = getTooltip();

    // Build tooltip content using text nodes for safety
    while (tt.firstChild && tt.firstChild !== arrowEl) tt.removeChild(tt.firstChild);

    const termDiv = document.createElement('div');
    termDiv.className = 'gt-tooltip-term';
    termDiv.textContent = entry.term;

    const defDiv = document.createElement('div');
    defDiv.className = 'gt-tooltip-def';
    defDiv.textContent = entry.shortDefinition;

    const linkEl = document.createElement('a');
    linkEl.className = 'gt-tooltip-link';
    linkEl.href = '/glossary/' + encodeURIComponent(entry.slug);
    linkEl.textContent = 'Read more \u2192';

    tt.insertBefore(linkEl, arrowEl);
    tt.insertBefore(defDiv, linkEl);
    tt.insertBefore(termDiv, defDiv);

    // Position above trigger
    const rect = trigger.getBoundingClientRect();
    const ttWidth = 280;
    let left = rect.left + rect.width / 2 - ttWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - ttWidth - 8));

    tt.style.width = ttWidth + 'px';
    tt.style.left = left + 'px';
    tt.style.top = (rect.top + window.scrollY - tt.offsetHeight - 8) + 'px';

    if (arrowEl) {
      arrowEl.style.left = (rect.left + rect.width / 2 - left - 5) + 'px';
      arrowEl.style.bottom = '-6px';
    }

    requestAnimationFrame(() => tt.classList.add('visible'));
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  async function loadTerms(): Promise<TermEntry[]> {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data;
      }
    } catch { /* ignore corrupt cache */ }

    try {
      const res = await fetch(API_URL);
      if (!res.ok) return [];
      const data: TermEntry[] = await res.json();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { /* full */ }
      return data;
    } catch {
      return [];
    }
  }

  function annotateTerms(terms: TermEntry[]) {
    if (!terms.length) return;

    // Build regex from terms sorted longest-first (API guarantees order)
    const escaped = terms.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'gi');

    const termMap = new Map<string, TermEntry>();
    for (const t of terms) termMap.set(t.term.toLowerCase(), t);

    const container = document.querySelector('main, article, .public-container, [role="main"]') || document.body;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (['SCRIPT','STYLE','CODE','PRE','A','INPUT','TEXTAREA'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.gt-trigger,.gt-tooltip,nav,header,footer')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) textNodes.push(current as Text);

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      if (!pattern.test(text)) continue;
      pattern.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIdx = 0;
      let m: RegExpExecArray | null;

      while ((m = pattern.exec(text)) !== null) {
        if (m.index > lastIdx) fragment.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));

        const matched = m[0];
        const entry = termMap.get(matched.toLowerCase());

        if (entry) {
          const span = document.createElement('span');
          span.className = 'gt-trigger';
          span.textContent = matched;
          span.setAttribute('tabindex', '0');
          span.addEventListener('mouseenter', () => showTooltip(span, entry));
          span.addEventListener('mouseleave', hideTooltip);
          span.addEventListener('focus', () => showTooltip(span, entry));
          span.addEventListener('blur', hideTooltip);
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(matched));
        }
        lastIdx = m.index + matched.length;
      }

      if (lastIdx < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIdx)));
      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }

  async function init() {
    const terms = await loadTerms();
    annotateTerms(terms);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
