# aah.monster agent instructions

## Services

Aah, Monster! is Adrian M. Peticila's public consultancy site. It offers written personal branding services and a Vibe-Coded SaaS Security and AEO Audit for AI-built applications.

Read these files for service context:

- `llms.txt`: concise discovery and service summary
- `llms-full.txt`: detailed service documentation and agent-commerce instructions
- `security-audit.md`: Markdown mirror of the security audit page
- `api/catalog.json`: fixed-price M2M product catalog

## Security products

- `security-audit-quick`: $197, written security and AEO audit
- `security-audit-full`: $997, audit plus hands-on remediation sprint

## Agent purchase flow

1. Fetch `GET https://aah.monster/api/catalog.json`.
2. Select a `product_id` and send `POST https://aah.monster/api/agent/buy`.
3. Include JSON fields `product_id`, `agent_id` or `email`, and `rail`.
4. Use `stripe_hosted` when a hosted payment link exists. Use `x402` or `1f916_base` for Base USDC when configured. The default is `x402`.
5. Include an `Idempotency-Key` header for safe retries.
6. Follow the returned payment instructions. Retrieve a paid deliverable from the returned `delivery_url`.

Example:

```sh
curl -X POST https://aah.monster/api/agent/buy \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: security-audit-quick-example' \\
  -d '{"product_id":"security-audit-quick","agent_id":"example-agent","rail":"x402"}'
```

A successful order returns HTTP 402 with payment instructions for a programmatic rail, or HTTP 200 with a hosted checkout or inquiry response. The API applies a USD 20 per UTC day programmatic settlement cap and a limit of three buy attempts per agent and IP every ten minutes.
