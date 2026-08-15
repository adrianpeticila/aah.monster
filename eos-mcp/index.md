# Eos MCP

**Drop-in MCP servers for your AI agents. Hosted, scaled, MIT.**

aah, monster! · [aah.monster/eos-mcp](https://aah.monster/eos-mcp/) · hello@aah.monster

---

## What this is

Eos MCP is a directory of curated Model Context Protocol servers. Point your agent at one and it gets instant, structured access to the tools you connect: files, databases, Slack, GitHub, search. No local daemons to babysit, no Docker to manage. Each server is hosted and scaled by Eos and MIT-licensed, so you can read the source and run it yourself.

Three ways in: a Free tier with a starter set of servers, Hosted Pro at $29/mo for the full catalog plus priority support, and Enterprise at $149/mo for dedicated capacity, SSO, and private deployments. All self-serve through the CLI. No calls.

---

## Pricing

| Tier | Price | What you get |
|---|---|---|
| Free | $0 | Starter server set, community support, rate limited, MIT license |
| Pro | $29/mo | Full catalog, priority support, higher rate limits, team workspaces, MIT license |
| Enterprise | $149/mo | Dedicated capacity, SSO / SAML, private deployments, SLA-backed support, MIT license |

Checkout links to placeholder Stripe URLs until billing is live.

---

## Featured servers

- **Eos Files** (free): read and write files across connected storage.
- **Eos Postgres** (pro): safe, authenticated SQL access to a database.
- **Eos Slack** (pro): post to channels and read threads.
- **Eos GitHub** (free): pull repos, list issues, open pull requests.
- **Eos Calendar** (pro): create and check events.
- **Eos Search** (enterprise): web and codebase search with citations.
- **Eos Email** (enterprise): draft and send mail with limits and an audit trail.
- **Eos Browser** (pro): fetch pages and fill forms on the live web.

---

## How to use

1. **Choose** servers from the catalog. Free servers need no plan.
2. **Add with one command:** `npx eos-mcp add github`
3. **Done.** Your agents can call the tools the next time they run.

---

## FAQ

**What is MCP?**
MCP stands for Model Context Protocol, an open standard that lets an AI agent call external tools with typed inputs. A server exposes tools; the agent runtime discovers and calls them.

**How do I connect Eos to Claude Code?**
Install the CLI and add a server. The CLI writes the entry into your Claude Code config, and Claude Code can reach it over the protocol.

**Can I cancel my plan?**
Yes. Cancel from the dashboard; the plan stops at the end of the current billing cycle.

**Do you build custom servers?**
Enterprise plans include a private deployment of the existing catalog. For a server built to your own API, email what you need in one paragraph and we quote a flat one-time price.

**Can I submit my own server?**
Yes. Contributing is open. Servers are reviewed for the MIT license, a clean readme, and stable tool schemas before listing.

---

## Submit yours

Built a server worth sharing? Email hello@aah.monster with the subject "Eos server submission". It gets reviewed and listed for free.

---

Published by aah, monster! © 2026. No calls.
