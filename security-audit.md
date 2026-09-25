# Vibe-Coded SaaS Security Audit

## Context

A security and Answer Engine Optimization audit for AI-built SaaS applications. This is the public Markdown mirror for agents and crawlers. The canonical web page is https://aah.monster/security-audit/.

## What is scanned

- Leaked environment keys and secrets in client bundles
- Supabase and Postgres row-level security, RLS policies, and exposed PostgREST data
- Permissive CORS, missing CSRF protection, and origin validation
- Prompt injection and untrusted input reaching privileged actions
- Admin routes, missing authentication, IDOR, and tenant isolation
- Webhook signatures, server actions, mass assignment, and secret exposure
- AI crawler exposure, robots policy, and public machine-readable discovery

## Products

### Quick Scan, $197

A written audit of the public application surface, client bundle, API routes, and AI crawler exposure. Delivered within 48 hours with prioritized findings and remediation steps.

### Full Audit, $997

Includes the Quick Scan plus a hands-on remediation sprint on a staging branch or sanitized environment. Includes Supabase RLS policies, edge auth and rate limiting, webhook HMAC verification, environment variable isolation, a ready-to-merge pull request, and post-deployment verification.

## Purchase and scan links

- Run the free canary: https://aah.monster/security-audit/
- Read the web page: https://aah.monster/security-audit/
- Machine-readable catalog: https://aah.monster/api/catalog.json
- Agent purchase endpoint: https://aah.monster/api/agent/buy
- Contact: hello@aah.monster

The canonical checkout instruction is the email link on the web page. No Stripe Hosted Payment Link is currently configured for these two products. Agents can use x402 or Base USDC when configured through the purchase endpoint, or Stripe Hosted Checkout when a link is added.
