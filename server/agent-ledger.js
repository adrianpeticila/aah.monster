'use strict';
/**
 * Deterministic local ledger for the agentic commerce layer.
 * State file: server/agent_ledger.json (git-ignored, recreated if missing).
 *
 * HARD-CODED CIRCUIT BREAKER CONSTANTS — never read from prompts, headers
 * or environment. Changing these requires a code change, on purpose.
 * (Env may hold SECRETS like PAYMENT_WEBHOOK_SECRET — never limits.)
 */
const fs = require('node:fs');
const path = require('node:path');

const DAILY_CAP_USD = 20;                 // max programmatic (x402) settlement, USD per UTC day
const RATE_LIMIT_MAX_ATTEMPTS = 3;        // buy attempts per IP per window
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const EUR_TO_USD = 1.08;                  // deterministic conversion used only for the USD cap

// Storage location ONLY (overridable for isolated test runs) — never a limit.
const LEDGER_PATH = process.env.AGENT_LEDGER_PATH || path.join(__dirname, 'agent_ledger.json');

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function freshLedger() {
  return {
    version: 1,
    utc_day: utcDay(),
    programmatic_settled_usd_cents: 0, // x402/zeroclick settlements (capped)
    hosted_settled_usd_cents: 0,        // stripe_hosted settlements (telemetry; human-in-the-loop)
    attempts: [],                       // rate limiter events {t, ip, agent}
    idempotency: {},                    // Idempotency-Key -> {status, body} replay cache
    orders: {},                         // order_token -> order record
  };
}

function load() {
  let led;
  try {
    led = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    if (!led || typeof led !== 'object') throw new Error('bad ledger');
  } catch {
    return freshLedger();
  }
  // Deterministic day rollover: reset day-scoped counters only.
  if (led.utc_day !== utcDay()) {
    led.utc_day = utcDay();
    led.programmatic_settled_usd_cents = 0;
    led.hosted_settled_usd_cents = 0;
    led.attempts = [];
  }
  if (!Array.isArray(led.attempts)) led.attempts = [];
  if (!led.idempotency || typeof led.idempotency !== 'object') led.idempotency = {};
  if (!led.orders || typeof led.orders !== 'object') led.orders = {};
  if (typeof led.programmatic_settled_usd_cents !== 'number') led.programmatic_settled_usd_cents = 0;
  if (typeof led.hosted_settled_usd_cents !== 'number') led.hosted_settled_usd_cents = 0;
  return led;
}

function save(led) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(led, null, 2) + '\n');
}

function recordAttempt(led, ip, agent) {
  led.attempts.push({ t: Date.now(), ip: ip || '', agent: agent || '' });
}

/** Count attempts in the sliding window (prunes expired events).
 *  Omit ip/agent to count all attempts; pass both to enforce the
 *  documented "3 per agent_id+IP per 10 minutes" contract. */
function attemptsInWindow(led, ip, agent) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  led.attempts = led.attempts.filter((a) => a.t >= cutoff);
  if (ip === undefined) return led.attempts.length;
  return led.attempts.filter((a) => a.ip === ip && a.agent === agent).length;
}

function eurToUsdCents(priceCents) {
  return Math.round(priceCents * EUR_TO_USD);
}

/** Remaining programmatic budget today, in USD cents. */
function programmaticRemainingUsdCents(led) {
  return DAILY_CAP_USD * 100 - (led.programmatic_settled_usd_cents || 0);
}

module.exports = {
  DAILY_CAP_USD,
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  EUR_TO_USD,
  LEDGER_PATH,
  load,
  save,
  recordAttempt,
  attemptsInWindow,
  eurToUsdCents,
  programmaticRemainingUsdCents,
};
