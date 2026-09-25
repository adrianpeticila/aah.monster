# Vibe-Coded SaaS Security Audit

## Context

A security and Answer Engine Optimization audit for AI-built SaaS applications. This is the public Markdown mirror for agents and crawlers. The canonical web page is https://aah.monster/security-audit/.

## Threat vectors and checks

1. **Open databases:** test Supabase RLS bypass paths, database grants, PostgREST exposure, and Firestore rules for unauthorized reads and writes.
2. **Broken user / workspace isolation:** test cross-tenant ID tampering and verify server-side ownership of every user and workspace identifier.
3. **Broken backend permissions and mass assignment:** test API authorization and writable-field allowlists, including role/plan tampering.
4. **Exposed secrets / API keys:** inspect frontend bundles for private service credentials and privileged API keys.
5. **Missing rate limits / spending caps:** test per-user and per-workspace throttles, usage quotas, and hard spending caps.
6. **Broken payment lifecycle:** test unverified webhooks and refund/cancel state handling across renewals and entitlement changes.
7. **Broken auth / recovery:** test stale sessions and reset token reuse, including revocation and single-use token enforcement.

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
- Order Quick Scan ($197): https://buy.stripe.com/5kQ6oH2R3d8qcaAcrTaIM06
- Request Remediation Sprint ($997): https://buy.stripe.com/5kQ9ATdvHfgycaA4ZraIM07
- Contact: hello@aah.monster

Direct checkout is available via Stripe Hosted Payment Links above. Agents can also use x402 or Base USDC when configured through the purchase endpoint.
