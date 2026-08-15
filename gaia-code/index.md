# Gaia Code

**Deterministic code grading for aah.monster. Score, grade, findings. No AI opinion, no calls.**

aah, monster! · [aah.monster/gaia-code](https://aah.monster/gaia-code/) · hello@aah.monster

---

## What this is

Gaia Code is a web tool that grades a pasted code snippet or a GitHub repo URL on code quality, maintainability, and best practices, plus an optional security pass. You get a 0 to 100 score, an A to F grade, and three findings you can act on.

It runs entirely in your browser. No account, no backend, no waiting.

Positioned honestly: at $19/mo it undercuts CodeRabbit's $24 to $48/mo plans. And unlike an AI assistant, Gaia Code is a deterministic heuristic. Same input in, same grade out, every time. It is a first-pass filter for junk code, not an opinion about your architecture.

---

## How it works

1. **Paste or link.** Drop a snippet in the text area or paste a GitHub repo URL. Pick your language.
2. **Grade it.** Click grade. The heuristics run in your browser against your code.
3. **Read the findings.** Score, grade, three findings. Unlock the full report with Pro.

---

## Scoring heuristics

Ten code checks plus an optional security pass:

- Comment ratio
- Line length
- Indentation consistency
- Nesting depth
- TODO / FIXME / HACK markers
- Magic numbers
- var declarations and loose assignment
- Function length
- console.log calls
- Naming style (single-letter variables)

Security checks (paid pass): eval(), hardcoded credentials, SQL injection via string concatenation, innerHTML XSS, plain http:// endpoints, weak md5 / sha1 hashing.

---

## Pricing

| Tier | Price | What you get |
|---|---|---|
| Free | $0 | Instant grade, A to F, three findings, no signup |
| Pro | $19/mo | Full report every heuristic, security audit, GitHub repo scanning, email delivery, unlimited grades |
| One-time | $49 | Full report plus security audit for a single project, no recurring charge |

Checkout is wired to Stripe once live.

---

## Honest limits

Gaia Code is a deterministic heuristic engine, not a code review by a senior engineer. It cannot understand intent, suggest architectural patterns, or evaluate business logic. If your code is structurally clean but logically wrong, Gaia Code will still give it an A. Use it as a first-pass filter before a human reviewer.

---

Published by aah, monster! © 2026. No calls.
