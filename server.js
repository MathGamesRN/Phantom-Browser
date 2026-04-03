const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Helper: resolve relative URLs to absolute
function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

// Helper: rewrite URLs in HTML so all links go through our proxy
function rewriteHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  // Rewrite <a href>
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('mailto:')) return;
    const abs = resolveUrl(baseUrl, href);
    if (abs) $(el).attr('href', `/proxy?url=${encodeURIComponent(abs)}`);
  });

  // Rewrite <form action>
  $('form[action]').each((_, el) => {
    const action = $(el).attr('action');
    if (!action) return;
    const abs = resolveUrl(baseUrl, action);
    if (abs) $(el).attr('action', `/proxy?url=${encodeURIComponent(abs)}`);
  });

  // Rewrite <img src>
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:')) return;
    const abs = resolveUrl(baseUrl, src);
    if (abs) $(el).attr('src', `/resource?url=${encodeURIComponent(abs)}`);
  });

  // Rewrite <link href> (CSS)
  $('link[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('data:')) return;
    const abs = resolveUrl(baseUrl, href);
    if (abs) $(el).attr('href', `/resource?url=${encodeURIComponent(abs)}`);
  });

  // Rewrite <script src>
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:')) return;
    const abs = resolveUrl(baseUrl, src);
    if (abs) $(el).attr('src', `/resource?url=${encodeURIComponent(abs)}`);
  });

  // Inject our toolbar
  const toolbar = `
    <style>
      #__proxy-toolbar {
        position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
        background: #0f0f12; border-bottom: 1px solid #2a2a35;
        display: flex; align-items: center; gap: 10px;
        padding: 8px 16px; font-family: 'DM Mono', monospace;
        box-shadow: 0 2px 20px rgba(0,0,0,0.5);
      }
      #__proxy-toolbar a.logo {
        color: #7c6af7; font-size: 13px; font-weight: 700;
        text-decoration: none; white-space: nowrap; letter-spacing: 0.05em;
      }
      #__proxy-toolbar input {
        flex: 1; background: #1a1a22; border: 1px solid #2a2a35;
        color: #e8e8f0; padding: 6px 12px; border-radius: 6px;
        font-family: 'DM Mono', monospace; font-size: 12px; outline: none;
      }
      #__proxy-toolbar input:focus { border-color: #7c6af7; }
      #__proxy-toolbar button {
        background: #7c6af7; color: #fff; border: none;
        padding: 6px 14px; border-radius: 6px; cursor: pointer;
        font-family: 'DM Mono', monospace; font-size: 12px;
      }
      #__proxy-toolbar button:hover { background: #6a58e0; }
      body { padding-top: 48px !important; }
    </style>
    <div id="__proxy-toolbar">
      <a class="logo" href="/">◈ PHANTOM</a>
      <input id="__proxy-url" type="text" value="${baseUrl}" placeholder="Enter URL or search..." />
      <button onclick="
        const v = document.getElementById('__proxy-url').value.trim();
        if (!v) return;
        const isUrl = v.startsWith('http://') || v.startsWith('https://') || /^[a-zA-Z0-9-]+\\.[a-zA-Z]{2,}/.test(v);
        const dest = isUrl ? (v.startsWith('http') ? v : 'https://' + v) : 'https://duckduckgo.com/?q=' + encodeURIComponent(v);
        window.location.href = '/proxy?url=' + encodeURIComponent(dest);
      ">Go</button>
      <button onclick="window.location.href='/'">Home</button>
    </div>
  `;

  $('body').prepend(toolbar);
  return $.html();
}

// Main proxy route
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.redirect('/');

  try {
    const response = await axios.get(targetUrl, {
      timeout: 15000,
      maxRedirects: 5,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('text/html')) {
      const html = response.data.toString('utf-8');
      const rewritten = rewriteHtml(html, targetUrl);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(rewritten);
    } else {
      res.setHeader('Content-Type', contentType);
      res.send(response.data);
    }
  } catch (err) {
    const msg = err.response ? `HTTP ${err.response.status}` : err.message;
    res.status(502).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Proxy Error</title>
      <style>
        body { background: #0f0f12; color: #e8e8f0; font-family: monospace;
               display: flex; flex-direction: column; align-items: center;
               justify-content: center; height: 100vh; margin: 0; }
        h1 { color: #7c6af7; } code { color: #f97; }
        a { color: #7c6af7; }
      </style>
      </head>
      <body>
        <h1>⚠ Proxy Error</h1>
        <p>Could not fetch: <code>${targetUrl}</code></p>
        <p>Reason: <code>${msg}</code></p>
        <p><a href="/">← Back to Phantom</a></p>
      </body>
      </html>
    `);
  }
});

// Resource proxy (images, CSS, JS, fonts, etc.)
app.get('/resource', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).end();

  try {
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      maxRedirects: 3,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(response.data);
  } catch {
    res.status(502).end();
  }
});

// DuckDuckGo search shortcut
app.get('/search', (req, res) => {
  const q = req.query.q;
  if (!q) return res.redirect('/');
  res.redirect(`/proxy?url=${encodeURIComponent('https://duckduckgo.com/?q=' + encodeURIComponent(q))}`);
});

app.listen(PORT, () => {
  console.log(`\n🔮 Phantom Proxy running at http://localhost:${PORT}\n`);
});
