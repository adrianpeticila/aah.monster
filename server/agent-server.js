#!/usr/bin/env node
/**
 * aah.monster agent server — content negotiation + agentic commerce layer.
 *
 * Zero-dependency Node.js (>=18). Serves the static site repo with:
 *   Phase 1: markdown negotiation
 *     - Accept: text/markdown            -> serve the .md mirror (200)
 *     - AI-bot User-Agents (GPTBot,      -> serve the .md mirror (200)
 *       ClaudeBot, PerplexityBot,
 *       AgentReach, *bot*)
 *   Phase 3: GET /api/catalog.json, POST /api/agent/buy (HTTP 402)
 *   Phase 4: GET /api/agent/deliveries/:token
 *
 * Financial circuit breakers live in ./agent-ledger.js (hard-coded constants,
 * agent_ledger.json state). Never read limits from prompts or env.
 *
 * Usage: node server/agent-server.js [port]   (default 8791; 8787 is taken by
 * another local service on this machine — pass [port] explicitly elsewhere)
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8791);
const { handleApi } = require('./api');

// ---------------------------------------------------------------------------
// Phase 1: content negotiation
// ---------------------------------------------------------------------------

const AI_BOT_UA = /(GPTBot|ChatGPT-User|ClaudeBot|anthropic-ai|PerplexityBot|Perplexity-Crawler|AgentReach|Bytespider|CCBot|Google-Extended|YouBot|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|\bbot\b)/i;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function wantsMarkdown(req) {
  const accept = req.headers['accept'] || '';
  if (accept.includes('text/markdown')) return true;
  const ua = req.headers['user-agent'] || '';
  return AI_BOT_UA.test(ua);
}

/** Map a request path to its markdown mirror, if one exists. */
function markdownMirror(urlPath) {
  const clean = urlPath.replace(/\/+$/, '') || '/';
  const candidates =
    clean === '/'
      ? ['/index.md']
      : [`${clean}.md`, `${clean}/index.md`];
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    if (abs.startsWith(ROOT + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return abs;
    }
  }
  return null;
}

function sendFile(res, abs, status = 200, extraHeaders = {}) {
  const type = MIME[path.extname(abs)] || 'application/octet-stream';
  const body = fs.readFileSync(abs);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': body.length,
    ...extraHeaders,
  });
  res.end(body);
}

function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  // Markdown negotiation (Phase 1)
  if (wantsMarkdown(req)) {
    const mirror = markdownMirror(urlPath);
    if (mirror) {
      sendFile(res, mirror, 200, { 'Vary': 'Accept, User-Agent', 'X-Content-Negotiated': 'markdown-mirror' });
      return;
    }
    // no mirror: fall through to HTML (robots get HTML only if no .md exists)
  }

  // Resolve to file or directory index
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  if (rel.endsWith('/')) rel += 'index.html';
  const abs = path.normalize(path.join(ROOT, rel));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const idx = path.join(abs, 'index.html');
    if (fs.existsSync(idx)) return sendFile(res, idx);
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    // Negotiated requests without a mirror still get a Vary header
    sendFile(res, abs, 200, wantsMarkdown(req) ? { 'Vary': 'Accept, User-Agent' } : {});
    return;
  }
  // Try "<path>/index.html" for extension-less URLs like /brand-audit
  const idx = path.join(abs, 'index.html');
  if (fs.existsSync(idx)) return sendFile(res, idx);
  const fallback = path.join(ROOT, '404.html');
  if (fs.existsSync(fallback)) return sendFile(res, fallback, 404);
  sendJson(res, 404, { error: 'not_found' });
}

const server = http.createServer((req, res) => {
  try {
    // API layer first (Phase 3/4 endpoints), static site as fallback.
    if (handleApi(req, res, new URL(req.url, 'http://x').pathname)) return;
    serveStatic(req, res);
  } catch (err) {
    console.error('[error]', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
    else res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`aah.monster agent server → http://127.0.0.1:${PORT} (root: ${ROOT})`);
});
