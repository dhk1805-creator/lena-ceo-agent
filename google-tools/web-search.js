#!/usr/bin/env node
require('./_env');
// Web Search — Le Na CEO Agent
// Auto-detect engine:
//   - Neu co GOOGLE_SEARCH_API_KEY + GOOGLE_CSE_ID -> Google Custom Search API (coverage tot hon)
//   - Nguoc lai -> DuckDuckGo HTML (khong can API key, fallback)
// Usage: node web-search.js "<query>" [max_results]
// Output: JSON { source, query, count, results: [{title, url, snippet}] }

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

async function searchGoogle() {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  // Google CSE tra ve toi da 10 results / request, can phan trang qua param `start`
  const results = [];
  const pages = Math.ceil(maxResults / 10);
  for (let p = 0; p < pages && results.length < maxResults; p++) {
    const start = p * 10 + 1;
    const num = Math.min(10, maxResults - results.length);
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cseId)}&q=${encodeURIComponent(query)}&num=${num}&start=${start}`;
    const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google CSE HTTP ${res.status}: ${body.substring(0, 200)}`);
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    for (const it of items) {
      if (results.length >= maxResults) break;
      results.push({
        title: stripTags(it.title || '').substring(0, 200),
        url: it.link || '',
        snippet: stripTags(it.snippet || '').substring(0, 300)
      });
    }
    if (items.length < num) break; // het ket qua
  }
  return { source: 'Google', query, count: results.length, results };
}

async function searchDuckDuckGo() {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'vi,en;q=0.8'
    }
  });
  if (!res.ok) {
    throw new Error(`DuckDuckGo HTTP ${res.status}`);
  }
  const html = await res.text();

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

  return { source: 'DuckDuckGo', query, count: results.length, results };
}

async function main() {
  const hasGoogle = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_CSE_ID);
  try {
    const out = hasGoogle ? await searchGoogle() : await searchDuckDuckGo();
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.log(JSON.stringify({
      error: e.message,
      source: hasGoogle ? 'Google' : 'DuckDuckGo',
      query
    }));
    process.exit(1);
  }
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
