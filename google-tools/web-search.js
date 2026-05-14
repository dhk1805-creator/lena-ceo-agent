#!/usr/bin/env node
require('./_env');
// Web Search — Le Na CEO Agent
// Tim kiem web qua DuckDuckGo HTML (khong can API key).
// Usage: node web-search.js "<query>" [max_results]
// Output: JSON { query, count, results: [{title, url, snippet}] }

const query = (process.argv[2] || '').trim();
const maxResults = Math.max(1, Math.min(20, parseInt(process.argv[3] || '10', 10)));

if (!query) {
  console.log(JSON.stringify({ error: 'Thieu query. Usage: web-search.js "<query>" [max_results]' }));
  process.exit(1);
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function unwrapDuckRedirect(href) {
  if (!href) return '';
  // DDG wraps real URLs in //duckduckgo.com/l/?uddg=<encoded>&rut=...
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch (e) {}
  }
  if (href.startsWith('//')) return 'https:' + href;
  return href;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  let html;
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'vi,en;q=0.8'
      }
    });
    if (!res.ok) {
      console.log(JSON.stringify({ error: `DuckDuckGo HTTP ${res.status}`, query }));
      process.exit(1);
    }
    html = await res.text();
  } catch (e) {
    console.log(JSON.stringify({ error: `Fetch failed: ${e.message}`, query }));
    process.exit(1);
  }

  // Match each result block (title link + snippet)
  const results = [];
  const blockRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null && results.length < maxResults) {
    const rawHref = m[1];
    const url = unwrapDuckRedirect(rawHref);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    // Skip DDG sponsored/ad links (y.js, ad_domain redirects to bing.com/aclick)
    if (/duckduckgo\.com\/y\.js/i.test(rawHref) || /duckduckgo\.com\/y\.js/i.test(url)) continue;
    if (/bing\.com\/aclick/i.test(url)) continue;
    // Skip DDG-internal links
    if (/duckduckgo\.com\//i.test(url) && !/duckduckgo\.com\/l\//i.test(rawHref)) continue;
    results.push({
      title: stripTags(m[2]).substring(0, 200),
      url,
      snippet: stripTags(m[3]).substring(0, 300)
    });
  }

  // Fallback: try simpler title-only match if no results captured
  if (results.length === 0) {
    const titleRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    while ((m = titleRe.exec(html)) !== null && results.length < maxResults) {
      const url = unwrapDuckRedirect(m[1]);
      if (!url || !/^https?:\/\//i.test(url)) continue;
      results.push({ title: stripTags(m[2]).substring(0, 200), url, snippet: '' });
    }
  }

  console.log(JSON.stringify({
    source: 'DuckDuckGo',
    query,
    count: results.length,
    results
  }, null, 2));
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
