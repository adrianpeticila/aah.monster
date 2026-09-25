#!/usr/bin/env bash
# tests/verify_agent_flow.sh — deterministic verifier for the aah.monster agentic layer.
# Phase 5 harness: content negotiation + discovery files + JSON schema + buy/deliver flow
# + MANDATORY FAILING CANARY: guardrail probes must be REJECTED (400/404/429/etc).
#
# Rules (S179): a verifier that cannot FAIL is not a verifier.
# Exit 0 = all green | exit 1 = at least one check failed | exit 2 = setup error.
#
# Usage: tests/verify_agent_flow.sh [--base URL]   (default: starts its own server on 127.0.0.1:8791)

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE=""
OWNED_SERVER=0
PORT=8791
SECRET="test-webhook-secret-do-not-use-prod"
TMPDIR_RUN="$(mktemp -d)"
PASS=0
FAIL=0
FAILED_CHECKS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:?--base needs a URL}"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

cleanup() {
  if [ "$OWNED_SERVER" = "1" ] && [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
  fi
  rm -rf "$TMPDIR_RUN"
}
trap cleanup EXIT

say()  { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS + 1)); printf '  [PASS] %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); FAILED_CHECKS+=("$1"); printf '  [FAIL] %s\n' "$1"; }
check_eq() { # label expected actual
  if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 — expected [$2] got [$3]"; fi
}
check_ne() { # label not_expected actual
  if [ "$2" != "$3" ]; then ok "$1 (got $3)"; else bad "$1 — must NOT be [$2]"; fi
}
check_contains() { # label haystack needle
  case "$2" in *"$3"*) ok "$1" ;; *) bad "$1 — [$3] not found" ;; esac
}
section() { printf '\n== %s ==\n' "$1"; }

# ---------------------------------------------------------------------------
# Setup: start own server with isolated ledger + webhook secret (unless --base)
# ---------------------------------------------------------------------------
if [ -z "$BASE" ]; then
  export AGENT_LEDGER_PATH="$TMPDIR_RUN/ledger.json"
  export PAYMENT_WEBHOOK_SECRET="$SECRET"
  node "$ROOT/server/agent-server.js" "$PORT" >"$TMPDIR_RUN/server.log" 2>&1 &
  SERVER_PID=$!
  OWNED_SERVER=1
  BASE="http://127.0.0.1:$PORT"
  for _ in $(seq 1 50); do
    if curl -sf -o /dev/null "$BASE/api/status"; then break; fi
    sleep 0.1
  done
  if ! curl -sf -o /dev/null "$BASE/api/status"; then
    say "FATAL: server did not come up on $PORT"
    cat "$TMPDIR_RUN/server.log"
    exit 2
  fi
  say "server up: $BASE (pid $SERVER_PID, isolated ledger)"
else
  say "using external base: $BASE"
  if [ -z "${PAYMENT_WEBHOOK_SECRET:-}" ]; then
    say "note: PAYMENT_WEBHOOK_SECRET not set — webhook checks may fail (expected against own server)"
  fi
  SECRET="${PAYMENT_WEBHOOK_SECRET:-$SECRET}"
fi

# ---------------------------------------------------------------------------
# CHECK 1 — content negotiation (Accept: text/markdown + bot UA)
# ---------------------------------------------------------------------------
section "1. content negotiation"
H1="$(curl -s -o "$TMPDIR_RUN/body.md" -w '%{content_type}' -H 'Accept: text/markdown' "$BASE/about/")"
check_contains "GET /about/ + Accept:text/markdown -> markdown content-type" "$H1" "text/markdown"
FIRST="$(head -c 1 "$TMPDIR_RUN/body.md")"
check_eq "markdown body starts with '#'" "#" "$FIRST"

H2="$(curl -s -o "$TMPDIR_RUN/body.html" -w '%{content_type}' -H 'Accept: text/html' "$BASE/about/")"
check_contains "GET /about/ + Accept:text/html -> html content-type" "$H2" "text/html"

H3="$(curl -s -o "$TMPDIR_RUN/body_bot.md" -w '%{content_type}' -A 'GPTBot/1.0' "$BASE/about/")"
check_contains "GET /about/ as GPTBot (no Accept) -> markdown mirror" "$H3" "text/markdown"

H4="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/llms.txt")"
check_eq "GET /llms.txt -> 200" "200" "$H4"

# ---------------------------------------------------------------------------
# CHECK 2 — discovery files (llms.txt, agent.json) + prices consistency
# ---------------------------------------------------------------------------
section "2. discovery files"
LLMS="$(curl -s "$BASE/llms.txt")"
check_contains "llms.txt mentions catalog endpoint" "$LLMS" "/api/catalog.json"
check_contains "llms.txt mentions buy 402 flow" "$LLMS" "/api/agent/buy"
check_contains "llms.txt price Personal Brand Audit €199" "$LLMS" "€199"
check_contains "llms.txt price Brand Positioning Sprint €499" "$LLMS" "€499"
check_contains "llms.txt price Voice Fingerprint €249" "$LLMS" "€249"
check_contains "llms.txt price AI Executive €1,500" "$LLMS" "€1,500"

AJ="$(curl -s "$BASE/.well-known/agent.json")"
echo "$AJ" | jq -e . >/dev/null 2>&1 && ok "agent.json is valid JSON" || bad "agent.json is valid JSON"
check_contains "agent.json endpoints.buy" "$AJ" "/api/agent/buy"
check_contains "agent.json guardrail daily cap 20" "$AJ" '"daily_programmatic_cap_usd": 20'
check_contains "agent.json guardrail rate limit 3/10min" "$AJ" "max 3 buy attempts"

# ---------------------------------------------------------------------------
# CHECK 3 — catalog JSON schema (strict)
# ---------------------------------------------------------------------------
section "3. catalog schema"
CAT_CODE="$(curl -s -o "$TMPDIR_RUN/catalog.json" -w '%{http_code}' "$BASE/api/catalog.json")"
check_eq "GET /api/catalog.json -> 200" "200" "$CAT_CODE"
C="$TMPDIR_RUN/catalog.json"
jq -e 'type=="array"' "$C" >/dev/null 2>&1 && ok "catalog is a JSON array" || bad "catalog is a JSON array"
jq -e 'length==9' "$C" >/dev/null 2>&1 && ok "catalog has 9 products" || bad "catalog has 9 products (got $(jq 'length' "$C" 2>/dev/null || echo '?'))"
jq -e 'all(.[]; (keys|sort)==["checkout_type","currency","description","id","name","price_cents","sample_output_url"])' "$C" >/dev/null 2>&1 \
  && ok "every product has exactly the 7 contract keys" || bad "every product has exactly the 7 contract keys"
jq -e 'all(.[]; (.price_cents|type)=="number" and (.price_cents|floor)==.price_cents and .price_cents>=0)' "$C" >/dev/null 2>&1 \
  && ok "price_cents non-negative integers" || bad "price_cents non-negative integers"
jq -e 'all(.[]; (.currency=="EUR" or .currency=="USD"))' "$C" >/dev/null 2>&1 && ok "currency EUR or USD" || bad "currency EUR or USD"
jq -e 'all(.[]; ((.sample_output_url|startswith("https://aah.monster/samples/")) or (.sample_output_url=="https://aah.monster/security-audit.md")))' "$C" >/dev/null 2>&1 \
  && ok "sample output URLs are absolute sample or security mirror URLs" || bad "sample output URLs are absolute sample or security mirror URLs"
jq -e 'all(.[]; .checkout_type=="stripe_hosted" or .checkout_type=="inquiry" or .checkout_type=="free")' "$C" >/dev/null 2>&1 \
  && ok "checkout_type in {stripe_hosted, inquiry, free}" || bad "checkout_type in {stripe_hosted, inquiry, free}"
check_eq "price brand-audit 19900" "19900" "$(jq -r '.[]|select(.id=="brand-audit")|.price_cents' "$C")"
check_eq "price voice-fingerprint 24900" "24900" "$(jq -r '.[]|select(.id=="voice-fingerprint")|.price_cents' "$C")"
check_eq "price positioning-sprint 49900" "49900" "$(jq -r '.[]|select(.id=="positioning-sprint")|.price_cents' "$C")"
check_eq "price ai-executive 150000" "150000" "$(jq -r '.[]|select(.id=="ai-executive")|.price_cents' "$C")"
check_eq "ai-executive checkout_type=inquiry" "inquiry" "$(jq -r '.[]|select(.id=="ai-executive")|.checkout_type' "$C")"
check_eq "free-checklist price 0" "0" "$(jq -r '.[]|select(.id=="free-checklist")|.price_cents' "$C")"
grep -q 'placeholder' "$C" && bad "no placeholder in catalog" || ok "no placeholder in catalog"
SAMPLES_OK=1
for u in $(jq -r '.[].sample_output_url' "$C"); do
  f="$ROOT${u#https://aah.monster}"
  [ -f "$f" ] || { SAMPLES_OK=0; bad "sample file exists: ${u#https://aah.monster}"; }
done
[ "$SAMPLES_OK" = "1" ] && ok "all 7 sample files exist locally"
# ---------------------------------------------------------------------------
# CHECK 4 — buy + deliver flow (all rails, idempotency, webhook settlement)
# ---------------------------------------------------------------------------
section "4. buy & deliver flow"
# 4a. stripe_hosted -> 200 with real IM00 checkout URL
R="$(curl -s -X POST "$BASE/api/agent/buy" -H 'Content-Type: application/json' \
  -d '{"product_id":"brand-audit","agent_id":"harness-stripe","rail":"stripe_hosted","email":"buyer@example.com"}')"
ST="$(echo "$R" | jq -r '.checkout_type // empty' 2>/dev/null)"
check_eq "stripe_hosted buy -> checkout_type stripe_hosted" "stripe_hosted" "$ST"
echo "$R" | grep -q 'buy.stripe.com/bJeeVdezL3xQ2A0dvXaIM00' && ok "stripe URL is the real IM00 link" || bad "stripe URL is the real IM00 link"
TOKEN_STRIPE="$(echo "$R" | jq -r '.order_token // empty' 2>/dev/null)"
[ -n "$TOKEN_STRIPE" ] && ok "stripe order_token issued" || bad "stripe order_token issued"

# 4b. deliveries before payment -> 402
D_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/agent/deliveries/$TOKEN_STRIPE")"
check_eq "deliveries before payment -> 402" "402" "$D_CODE"

# 4c. programmatic x402 -> 402 with payment instructions + guardrails
R402="$(curl -s -o "$TMPDIR_RUN/r402.json" -w '%{http_code}' -X POST "$BASE/api/agent/buy" \
  -H 'Content-Type: application/json' -d '{"product_id":"voice-fingerprint","agent_id":"harness-x402","rail":"x402"}')"
check_eq "x402 buy -> 402" "402" "$R402"
jq -e '.error=="payment_required"' "$TMPDIR_RUN/r402.json" >/dev/null 2>&1 && ok "402 body error=payment_required" || bad "402 body error=payment_required"
jq -e '.guardrails.daily_programmatic_cap_usd==20' "$TMPDIR_RUN/r402.json" >/dev/null 2>&1 \
  && ok "402 body advertises USD 20/day cap" || bad "402 body advertises USD 20/day cap"
jq -e '.price_cents==24900 and .currency=="EUR"' "$TMPDIR_RUN/r402.json" >/dev/null 2>&1 \
  && ok "402 body carries exact price 24900 EUR" || bad "402 body carries exact price 24900 EUR"
TOKEN_X402="$(jq -r '.order_token // empty' "$TMPDIR_RUN/r402.json" 2>/dev/null)"
[ -n "$TOKEN_X402" ] && ok "x402 order_token issued" || bad "x402 order_token issued"

# 4d. inquiry product -> 200 mailto, does NOT block catalog
R_INQ="$(curl -s -X POST "$BASE/api/agent/buy" -H 'Content-Type: application/json' \
  -d '{"product_id":"ai-executive","agent_id":"harness-inq"}')"
echo "$R_INQ" | grep -q 'mailto:hello@aah.monster' && ok "ai-executive -> inquiry mailto URL" || bad "ai-executive -> inquiry mailto URL"
echo "$R_INQ" | grep -q '"checkout_type": "inquiry"' && ok "ai-executive -> checkout_type inquiry" || bad "ai-executive -> checkout_type inquiry"

# 4e. idempotency: same Idempotency-Key twice -> same order_token
IDK="harness-idem-$$"
curl -s -X POST "$BASE/api/agent/buy" -H 'Content-Type: application/json' -H "Idempotency-Key: $IDK" \
  -d '{"product_id":"positioning-sprint","agent_id":"harness-idem","rail":"stripe_hosted"}' > "$TMPDIR_RUN/idem1.json"
curl -s -D "$TMPDIR_RUN/idem2.hdr" -o "$TMPDIR_RUN/idem2.json" -X POST "$BASE/api/agent/buy" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $IDK" \
  -d '{"product_id":"positioning-sprint","agent_id":"harness-idem","rail":"stripe_hosted"}'
T1="$(jq -r '.order_token' "$TMPDIR_RUN/idem1.json" 2>/dev/null)"
T2="$(jq -r '.order_token' "$TMPDIR_RUN/idem2.json" 2>/dev/null)"
check_eq "idempotent replay returns same order_token" "$T1" "$T2"
grep -qi 'Idempotency-Replayed: true' "$TMPDIR_RUN/idem2.hdr" && ok "replay sets Idempotency-Replayed header" || bad "replay sets Idempotency-Replayed header"
# 4f. webhook settlement stripe order (hosted = unlimited) -> paid -> delivery 200 json
BODY_ST="{\"order_token\":\"$TOKEN_STRIPE\",\"status\":\"succeeded\",\"tx_reference\":\"harness-tx-stripe\"}"
SIG_ST="sha256=$(printf '%s' "$BODY_ST" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')"
W_ST="$(curl -s -X POST "$BASE/api/agent/payments/webhook" -H 'Content-Type: application/json' \
  -H "X-Payment-Signature: $SIG_ST" -d "$BODY_ST")"
echo "$W_ST" | grep -q '"status": "paid"' && ok "stripe webhook -> paid (hosted unlimited)" || bad "stripe webhook -> paid (hosted unlimited); got: $W_ST"
DJ="$(curl -s -o "$TMPDIR_RUN/deliv.json" -w '%{http_code}|%{content_type}' "$BASE/api/agent/deliveries/$TOKEN_STRIPE")"
case "$DJ" in 200\|application/json*) ok "paid delivery -> 200 application/json" ;; *) bad "paid delivery -> 200 application/json (got $DJ)" ;; esac
jq -e '.status=="paid" and .product.id=="brand-audit"' "$TMPDIR_RUN/deliv.json" >/dev/null 2>&1 \
  && ok "delivery payload status=paid + correct product" || bad "delivery payload status=paid + correct product"

# 4g. paid delivery content negotiation -> text/markdown
DM="$(curl -s -o "$TMPDIR_RUN/deliv.md" -w '%{content_type}' -H 'Accept: text/markdown' "$BASE/api/agent/deliveries/$TOKEN_STRIPE")"
check_contains "paid delivery + Accept:text/markdown -> markdown" "$DM" "text/markdown"
check_contains "markdown receipt contains order_token" "$(cat "$TMPDIR_RUN/deliv.md")" "$TOKEN_STRIPE"

# 4h. programmatic settlement over cap -> held_for_review -> deliveries 403
BODY_X="{\"order_token\":\"$TOKEN_X402\",\"status\":\"succeeded\",\"tx_reference\":\"harness-tx-x402\"}"
SIG_X="sha256=$(printf '%s' "$BODY_X" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')"
W_X="$(curl -s -X POST "$BASE/api/agent/payments/webhook" -H 'Content-Type: application/json' \
  -H "X-Payment-Signature: $SIG_X" -d "$BODY_X")"
echo "$W_X" | grep -q '"status": "held_for_review"' \
  && ok "x402 settlement over USD 20 cap -> held_for_review" \
  || bad "x402 settlement over USD 20 cap -> held_for_review; got: $W_X"
H_CODE="$(curl -s -o "$TMPDIR_RUN/held.json" -w '%{http_code}' "$BASE/api/agent/deliveries/$TOKEN_X402")"
check_eq "held_for_review delivery -> 403" "403" "$H_CODE"
jq -e '.error=="held_for_review"' "$TMPDIR_RUN/held.json" >/dev/null 2>&1 \
  && ok "held response names held_for_review + cap reason" || bad "held response names held_for_review + cap reason"

# 4i. status endpoint reports ledger totals
ST_CODE="$(curl -s -o "$TMPDIR_RUN/status.json" -w '%{http_code}' "$BASE/api/status")"
check_eq "GET /api/status -> 200" "200" "$ST_CODE"
jq -e '.programmatic.daily_cap_usd_cents==2000 and (.programmatic.settled_usd_cents>0)' "$TMPDIR_RUN/status.json" >/dev/null 2>&1 \
  && ok "status shows cap 2000c + settled >0 (over-cap recorded)" || bad "status shows cap 2000c + settled >0 (over-cap recorded)"
# ---------------------------------------------------------------------------
# CHECK 5 — MANDATORY FAILING CANARY (S179)
# Guardrail probes MUST be rejected. A 2xx here means a guardrail is missing
# or weakened -> the harness FAILS (exit 1) and the release is blocked.
# ---------------------------------------------------------------------------
section "5. canary (mandatory failing)"

# Canary A: unknown product_id must be rejected (400/404/429, never 200/402)
C1="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/buy" \
  -H 'Content-Type: application/json' -d '{"product_id":"definitely-not-a-product","agent_id":"canary-a"}')"
case "$C1" in
  400|404|429) ok "canary A: unknown product_id -> rejected ($C1)" ;;
  200|402)     bad "canary A: unknown product_id was ACCEPTED ($C1) — guardrail missing" ;;
  *)           bad "canary A: unexpected status $C1 (wanted 400/404/429)" ;;
esac

# Canary B: malformed JSON body -> 400, never 200/402
C2="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/buy" \
  -H 'Content-Type: application/json' -d 'not-json{{{')"
case "$C2" in
  400|413|429) ok "canary B: malformed body -> rejected ($C2)" ;;
  200|402)     bad "canary B: malformed body was ACCEPTED ($C2) — guardrail missing" ;;
  *)           bad "canary B: unexpected status $C2 (wanted 400/413/429)" ;;
esac

# Canary C: missing agent_id+email -> 400
C3="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/buy" \
  -H 'Content-Type: application/json' -d '{"product_id":"brand-audit"}')"
case "$C3" in
  400|429) ok "canary C: missing identity -> rejected ($C3)" ;;
  200|402) bad "canary C: anonymous buy was ACCEPTED ($C3) — guardrail missing" ;;
  *)       bad "canary C: unexpected status $C3 (wanted 400/429)" ;;
esac

# Canary D: rate limit — 4th buy attempt from same agent_id+IP -> 429
RATE_OK=1
for i in 1 2 3 4; do
  C4="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/buy" \
    -H 'Content-Type: application/json' -d '{"product_id":"brand-audit","agent_id":"canary-rate","rail":"stripe_hosted"}')"
  if [ "$i" -lt 4 ]; then
    case "$C4" in 200|402) : ;; *) RATE_OK=0; bad "canary D: attempt $i should pass (got $C4)" ;; esac
  else
    case "$C4" in
      429) : ;;
      200|402) RATE_OK=0; bad "canary D: attempt 4 was ACCEPTED ($C4) — rate limit missing/weakened" ;;
      *) RATE_OK=0; bad "canary D: attempt 4 unexpected status $C4 (wanted 429)" ;;
    esac
  fi
done
[ "$RATE_OK" = "1" ] && ok "canary D: 4th buy attempt -> 429 (3/10min/IP enforced)"

# Canary E: webhook without valid HMAC signature -> 401, never 200
C5="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/agent/payments/webhook" \
  -H 'Content-Type: application/json' -H "X-Payment-Signature: sha256=deadbeef" \
  -d '{"order_token":"forged","status":"succeeded"}')"
case "$C5" in
  401|403|404) ok "canary E: forged webhook signature -> rejected ($C5)" ;;
  200)         bad "canary E: forged webhook was ACCEPTED — settlement guardrail missing" ;;
  503)         ok "canary E: webhook disabled without secret (503 fail-closed)" ;;
  *)           bad "canary E: unexpected status $C5 (wanted 401/403/404/503)" ;;
esac

# Canary F: unknown delivery token -> 404, never 200
C6="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/agent/deliveries/ord_forged_token")"
case "$C6" in
  404) ok "canary F: unknown delivery token -> 404" ;;
  200) bad "canary F: forged delivery token was ACCEPTED — token guardrail missing" ;;
  *)   bad "canary F: unexpected status $C6 (wanted 404)" ;;
esac

# Canary G: unknown API endpoint under /api/ -> 404 JSON (no HTML crash)
C7="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/no-such-endpoint")"
case "$C7" in
  404) ok "canary G: unknown /api/ endpoint -> 404" ;;
  200) bad "canary G: unknown endpoint ACCEPTED — routing guardrail missing" ;;
  *)   bad "canary G: unexpected status $C7 (wanted 404)" ;;
esac

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
printf '\n== summary ==\n'
printf 'passed: %d  failed: %d  total: %d\n' "$PASS" "$FAIL" "$TOTAL"
if [ "$FAIL" -gt 0 ]; then
  printf 'failed checks:\n'
  for f in "${FAILED_CHECKS[@]}"; do printf '  - %s\n' "$f"; done
  printf '\nRESULT: FAIL\n'
  exit 1
fi
printf '\nRESULT: PASS\n'
exit 0
