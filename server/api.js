'use strict';
/**
 * aah.monster — agentic commerce API (Faza 3 + 4).
 * Mounted by server/agent-server.js: handleApi(req, res, pathname) -> true if handled.
 *
 * Routes:
 *   GET  /api/catalog.json             strict product catalog (source: api/catalog.json)
 *   POST /api/agent/buy                HTTP 402 (x402/zeroclick) or 200 (stripe_hosted | inquiry | free)
 *   GET  /api/agent/deliveries/:token  paid -> payload (json/markdown); awaiting -> 402; held -> 403; unknown -> 404
 *   POST /api/agent/payments/webhook   HMAC-signed settlement -> paid / held_for_review
 *   GET  /api/status                   uptime + ledger day totals
 *
 * Circuit breakers: hard-coded in ./agent-ledger.js (never env/prompt) —
 *   programmatic daily cap USD 20 -> over-cap held_for_review (stripe_hosted unlimited),
 *   3 buy attempts per agent_id+IP per 10 min -> 429, unknown product -> 404, bad body -> 400.
 * Env = secrets/addresses only, NEVER limits:
 *   PAYMENT_WEBHOOK_SECRET  HMAC secret (unset -> webhook 503, fail closed)
 *   X402_PAYTO_ADDRESS      Base payTo for x402 intents (unset -> rail configured:false + Stripe fallback)
 *
 * Known limitation (documented, deliberate): malformed-body floods are not keyed
 * per agent (no identity in an invalid body); 64KB body cap + edge absorbs this.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  load, save, recordAttempt, attemptsInWindow, eurToUsdCents,
  DAILY_CAP_USD, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS,
} = require('./agent-ledger');

const ROOT = path.resolve(__dirname, '..');
const CATALOG_FILE = path.join(ROOT, 'api', 'catalog.json');
const CAP_CENTS = DAILY_CAP_USD * 100;
const MAX_BODY_BYTES = 64 * 1024;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

// Real Stripe Payment Links verified on the live pages (IM00–IM04). No placeholders.
const STRIPE = {
  'brand-audit': 'https://buy.stripe.com/bJeeVdezL3xQ2A0dvXaIM00',
  'voice-fingerprint': 'https://buy.stripe.com/7sY4gzajvb0i8YogI9aIM04',
  'positioning-sprint': 'https://buy.stripe.com/9B6cN58bnb0ieiIeA1aIM01',
  'the-monster-job': 'https://buy.stripe.com/00w7sL8bn9We5Mc2RjaIM02',
  'monster-retainer': 'https://buy.stripe.com/eVq6oHbnzfgyb6wgI9aIM03',
};
// ai-executive has NO Stripe link on the site: inquiry-only, never blocks the catalog.
const INQUIRY = { 'ai-executive': 'mailto:hello@aah.monster?subject=AI%20Executive%20System%20inquiry' };

function send(res, status, contentType, body, extra = {}) {
  const buf = Buffer.from(body);
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': buf.length, ...extra });
  res.end(buf);
}
function sendJson(res, status, obj, extra = {}) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj, null, 2), extra);
}
function httpError(status, code, extra = {}) {
  const e = new Error(code);
  e.status = status; e.code = code; e.extra = extra;
  return e;
}
function loadCatalog() {
  try {
    const a = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}
function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let done = false;
    req.on('data', (c) => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; reject(httpError(413, 'body_too_large')); req.resume(); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', (err) => { if (!done) { done = true; reject(err); } });
  });
}
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (xff || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}
function stripeUrl(productId, email) {
  const base = STRIPE[productId];
  if (!base) return null;
  return email ? `${base}?prefilled_email=${encodeURIComponent(email)}` : base;
}
function newOrderToken() { return `ord_${crypto.randomBytes(18).toString('hex')}`; }
function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function pruneIdempotency(led) {
  const now = Date.now();
  for (const [k, v] of Object.entries(led.idempotency)) {
    if (!v || typeof v.at !== 'number' || now - v.at > IDEMPOTENCY_TTL_MS) delete led.idempotency[k];
  }
}
const RAILS = new Set(['x402', 'zeroclick', '1f916_base', 'stripe_hosted']);
const PROGRAMMATIC_RAILS = new Set(['x402', 'zeroclick', '1f916_base']);
const DELIVERY_SLA = {
  'brand-audit': '48-72h',
  'voice-fingerprint': '48h',
  'positioning-sprint': '5 business days',
  'ai-executive': '48-72h',
  'the-monster-job': '4 weeks',
  'monster-retainer': 'monthly cycle',
  'free-checklist': 'instant',
};

function idemKeyOf(req, agent) {
  const k = req.headers['idempotency-key'];
  return k ? `${agent}::${k}` : '';
}
function loadOrder(led, token) {
  return led.orders && typeof led.orders === 'object' ? led.orders[token] : undefined;
}
function requireBuyFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be a JSON object';
  if (typeof body.product_id !== 'string' || !body.product_id.trim()) return 'product_id is required';
  const hasAgent = typeof body.agent_id === 'string' && body.agent_id.trim().length > 0;
  const hasEmail = typeof body.email === 'string' && body.email.trim().length > 0;
  if (!hasAgent && !hasEmail) return 'agent_id or email is required';
  return null;
}
function handleCatalog(res) {
  let raw; let arr;
  try { raw = fs.readFileSync(CATALOG_FILE, 'utf8'); arr = JSON.parse(raw); } catch { sendJson(res, 500, { error: 'catalog_unreadable' }); return; }
  if (!Array.isArray(arr)) { sendJson(res, 500, { error: 'catalog_invalid', detail: 'catalog must be a JSON array' }); return; }
  send(res, 200, 'application/json; charset=utf-8', raw, { Vary: 'Accept', 'Cache-Control': 'public, max-age=300' });
}
function handleStatus(res) {
  const led = load();
  const orders = Object.values(led.orders || {});
  const byStatus = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  sendJson(res, 200, {
    service: 'aah.monster agent api',
    uptime_seconds: Math.round(process.uptime()),
    utc_day: led.utc_day,
    programmatic: {
      settled_usd_cents: led.programmatic_settled_usd_cents,
      daily_cap_usd_cents: CAP_CENTS,
      remaining_usd_cents: Math.max(0, CAP_CENTS - led.programmatic_settled_usd_cents),
    },
    hosted_settled_usd_cents: led.hosted_settled_usd_cents,
    rate_limit: { max_attempts: RATE_LIMIT_MAX_ATTEMPTS, window_seconds: RATE_LIMIT_WINDOW_MS / 1000 },
    orders: { total: orders.length, by_status: byStatus },
  }, { 'Cache-Control': 'no-store' });
}
function deliveryPayload(led, order) {
  const product = loadCatalog().find((p) => p.id === order.product_id) || { id: order.product_id, name: order.product_id, sample_output_url: null };
  const sla = DELIVERY_SLA[order.product_id] || 'see product page';
  return {
    order_token: order.token,
    status: 'paid',
    product: { id: product.id, name: product.name, price_cents: order.price_cents, currency: order.currency },
    order: { rail: order.rail, created_at: order.created_at, paid_at: order.paid_at || null, tx_reference: order.tx_reference || null, agent_id: order.agent_id || null },
    deliverable: {
      mode: 'async_written',
      sla,
      contact: 'hello@aah.monster',
      site_url: `https://aah.monster/${order.product_id}/`,
      sample_output_url: product.sample_output_url || null,
      next_steps: ['no calls: deliverables are written and delivered async', `expect delivery within ${sla} after payment confirmation`, `quote order_token ${order.token} to hello@aah.monster for status`],
    },
  };
}
function deliveryMarkdown(p) {
  return [
    `# order ${p.order_token} — paid`,
    '',
    `**${p.product.name}** — ${p.product.price_cents / 100} ${p.product.currency} · rail: ${p.order.rail}`,
    '',
    `status: paid${p.order.paid_at ? ` · paid_at: ${p.order.paid_at}` : ''}${p.order.tx_reference ? ` · tx: ${p.order.tx_reference}` : ''}`,
    '',
    '## what happens next',
    ...p.deliverable.next_steps.map((s) => `- ${s}`),
    '',
    `product page: ${p.deliverable.site_url}`,
    `sample: ${p.deliverable.sample_output_url}`,
    `contact: ${p.deliverable.contact}`,
    '',
  ].join('\n');
}
function handleDeliveries(req, res, token) {
  if (!token) { sendJson(res, 400, { error: 'missing_token', detail: 'GET /api/agent/deliveries/{token}' }); return; }
  const led = load();
  const order = loadOrder(led, token);
  if (!order) { sendJson(res, 404, { error: 'unknown_token' }); return; }
  if (order.status === 'awaiting_payment') { sendJson(res, 402, { error: 'payment_required', order_token: token, status: order.status }); return; }
  if (order.status === 'held_for_review') {
    sendJson(res, 403, {
      error: 'held_for_review',
      order_token: token,
      status: order.status,
      reason: `programmatic settlement exceeded the hard-coded USD ${DAILY_CAP_USD}/day cap (Option A); a human must release delivery.`,
      settled_today_usd_cents: led.programmatic_settled_usd_cents,
      contact: 'hello@aah.monster',
    });
    return;
  }
  if (order.status !== 'paid') { sendJson(res, 409, { error: 'unexpected_order_status', status: order.status }); return; }
  const payload = deliveryPayload(led, order);
  const accept = String(req.headers.accept || '');
  if (accept.includes('text/markdown') && !accept.includes('application/json')) {
    send(res, 200, 'text/markdown; charset=utf-8', deliveryMarkdown(payload), { Vary: 'Accept' });
    return;
  }
  sendJson(res, 200, payload, { Vary: 'Accept' });
}
async function handleBuy(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) {
    if (e.status === 413) throw e;
    throw httpError(400, 'invalid_json', { detail: 'request body must be valid JSON' });
  }
  const fieldErr = requireBuyFields(body);
  if (fieldErr) throw httpError(400, 'missing_fields', { detail: fieldErr });

  const productId = body.product_id.trim();
  const agent = (typeof body.agent_id === 'string' && body.agent_id.trim()) || body.email.trim();
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const rail = body.rail === undefined ? 'x402' : String(body.rail);
  if (!RAILS.has(rail)) throw httpError(400, 'unknown_rail', { detail: 'rail must be one of x402 | zeroclick | 1f916_base | stripe_hosted' });

  const ip = clientIp(req);
  const led = load();
  pruneIdempotency(led);

  // Idempotent replay: same Idempotency-Key returns the stored response verbatim.
  const idemKey = idemKeyOf(req, agent);
  if (idemKey && led.idempotency[idemKey]) {
    const hit = led.idempotency[idemKey];
    sendJson(res, hit.status, hit.body, { 'Idempotency-Replayed': 'true' });
    return;
  }

  // Circuit breaker: 3 buy attempts per agent_id+IP per 10 min (hard-coded in ledger).
  recordAttempt(led, ip, agent);
  const attempts = attemptsInWindow(led, ip, agent);
  save(led);
  if (attempts > RATE_LIMIT_MAX_ATTEMPTS) {
    throw httpError(429, 'rate_limited', {
      detail: `max ${RATE_LIMIT_MAX_ATTEMPTS} buy attempts per agent_id+IP per ${RATE_LIMIT_WINDOW_MS / 60000} minutes`,
      retry_after_seconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  const product = loadCatalog().find((p) => p.id === productId);
  if (!product) throw httpError(404, 'unknown_product', { detail: `product_id '${productId}' not in catalog`, catalog: '/api/catalog.json' });

  const now = new Date().toISOString();
  const usdCents = eurToUsdCents(product.price_cents);
  let status; let payload;

  if (product.checkout_type === 'inquiry') {
    status = 200;
    payload = {
      checkout_type: 'inquiry', product_id: productId, price_cents: product.price_cents, currency: product.currency,
      inquiry_url: INQUIRY[productId] || 'mailto:hello@aah.monster',
      note: 'no autonomous checkout for this product — open a written inquiry; a human replies async.',
    };
  } else if (product.checkout_type === 'free' || product.price_cents === 0) {
    const token = newOrderToken();
    led.orders[token] = { token, product_id: productId, agent, email, rail: 'free', checkout_type: 'free', price_cents: 0, currency: product.currency, usd_cents: 0, status: 'paid', created_at: now, paid_at: now };
    save(led);
    status = 200;
    payload = { checkout_type: 'free', order_token: token, status: 'paid', product_id: productId, price_cents: 0, currency: product.currency, delivery_url: `/api/agent/deliveries/${token}`, note: 'zero-cost order — delivered immediately, no settlement required.' };
  } else if (rail === 'stripe_hosted') {
    const token = newOrderToken();
    led.orders[token] = { token, product_id: productId, agent, email, rail: 'stripe_hosted', checkout_type: 'stripe_hosted', price_cents: product.price_cents, currency: product.currency, usd_cents: usdCents, status: 'awaiting_payment', created_at: now, paid_at: null };
    save(led);
    status = 200;
    payload = { checkout_type: 'stripe_hosted', order_token: token, status: 'awaiting_payment', product_id: productId, price_cents: product.price_cents, currency: product.currency, checkout_url: stripeUrl(productId, email), delivery_url: `/api/agent/deliveries/${token}`, note: 'hosted checkout is unlimited (Option A): the USD/day cap applies only to programmatic settlement.' };
  } else {
    // Option A: programmatic rails get HTTP 402 with payment details + hard cap warning.
    const token = newOrderToken();
    led.orders[token] = { token, product_id: productId, agent, email, rail, checkout_type: 'programmatic', price_cents: product.price_cents, currency: product.currency, usd_cents: usdCents, status: 'awaiting_payment', created_at: now, paid_at: null };
    save(led);
    status = 402;
    payload = {
      error: 'payment_required', order_token: token, product_id: productId, price_cents: product.price_cents, currency: product.currency, usd_cents: usdCents, rail,
      payment: {
        protocol: rail === 'x402' ? 'HTTP 402 / x402' : rail,
        pay_to: process.env.X402_PAYTO_ADDRESS || null,
        configured: Boolean(process.env.X402_PAYTO_ADDRESS),
        settle_endpoint: 'POST /api/agent/payments/webhook (HMAC-SHA256 over raw body)',
        note: process.env.X402_PAYTO_ADDRESS ? 'pay USDC to pay_to, then confirm via signed webhook.' : 'no pay_to configured yet — use rail=stripe_hosted for hosted checkout, or wait for x402 configuration.',
      },
      guardrails: { daily_programmatic_cap_usd: DAILY_CAP_USD, over_cap_status: 'held_for_review', rate_limit: `${RATE_LIMIT_MAX_ATTEMPTS} per agent_id+IP per ${RATE_LIMIT_WINDOW_MS / 60000}min` },
      delivery_url: `/api/agent/deliveries/${token}`,
    };
  }

  if (idemKey) { led.idempotency[idemKey] = { status, body: payload, at: Date.now() }; save(led); }
  sendJson(res, status, payload);
}
async function handleWebhook(req, res) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) throw httpError(503, 'webhook_disabled', { detail: 'PAYMENT_WEBHOOK_SECRET not set — settlement confirmations disabled (fail closed)' });

  const raw = await readBody(req);
  const sigHeader = String(req.headers['x-payment-signature'] || '').replace(/^sha256=/i, '');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(sigHeader); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw httpError(401, 'bad_signature', { detail: 'X-Payment-Signature must be sha256=HMAC-SHA256(raw body, PAYMENT_WEBHOOK_SECRET)' });

  let body;
  try { body = JSON.parse(raw); } catch { throw httpError(400, 'invalid_json'); }
  if (!body || typeof body.order_token !== 'string') throw httpError(400, 'missing_fields', { detail: 'order_token is required' });
  if (body.status !== 'succeeded') throw httpError(400, 'payment_not_succeeded', { detail: 'status must be "succeeded"' });

  const led = load();
  const order = loadOrder(led, body.order_token);
  if (!order) throw httpError(404, 'unknown_order');
  if (order.status === 'paid' || order.status === 'held_for_review') {
    sendJson(res, 200, { order_token: order.token, status: order.status, idempotent_replay: true, delivery_url: `/api/agent/deliveries/${order.token}` });
    return;
  }

  const programmatic = PROGRAMMATIC_RAILS.has(order.rail);
  let status;
  if (programmatic) {
    led.programmatic_settled_usd_cents += order.usd_cents;
    // Option A: hard cap USD 20/day on programmatic settlement; over-cap -> held_for_review.
    status = led.programmatic_settled_usd_cents > CAP_CENTS ? 'held_for_review' : 'paid';
  } else {
    led.hosted_settled_usd_cents += order.usd_cents;
    status = 'paid';
  }
  order.status = status;
  order.paid_at = new Date().toISOString();
  order.tx_reference = typeof body.tx_reference === 'string' ? body.tx_reference : null;
  led.orders[order.token] = order;
  save(led);

  sendJson(res, 200, {
    order_token: order.token, status,
    ...(status === 'held_for_review' ? { reason: `daily programmatic cap of USD ${DAILY_CAP_USD} exceeded`, settled_today_usd_cents: led.programmatic_settled_usd_cents } : {}),
    delivery_url: `/api/agent/deliveries/${order.token}`,
  });
}

function handleApi(req, res, pathname) {
  const method = String(req.method || 'GET').toUpperCase();
  const want = (m, p) => method === m && pathname === p;
  const run = (fn) => {
    Promise.resolve().then(fn).catch((err) => {
      const s = err.status || 500;
      if (!res.headersSent) sendJson(res, s, { error: err.code || 'internal_error', ...(err.extra || {}) });
      else res.end();
    });
    return true;
  };

  if (want('GET', '/api/catalog.json')) return run(() => handleCatalog(res));
  if (want('GET', '/api/status')) return run(() => handleStatus(res));
  if (want('POST', '/api/agent/buy')) return run(() => handleBuy(req, res));
  if (want('POST', '/api/agent/payments/webhook')) return run(() => handleWebhook(req, res));
  if (pathname.startsWith('/api/agent/deliveries/')) {
    if (method !== 'GET') { sendJson(res, 405, { error: 'method_not_allowed', allow: 'GET' }); return true; }
    const token = decodeURIComponent(pathname.slice('/api/agent/deliveries/'.length)).replace(/\/+$/, '');
    return run(() => handleDeliveries(req, res, token));
  }
  if (pathname.startsWith('/api/')) { sendJson(res, 404, { error: 'unknown_endpoint', detail: 'see /.well-known/agent.json#endpoints' }); return true; }
  return false;
}

module.exports = { handleApi, STRIPE, INQUIRY };