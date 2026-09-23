# MCP Positioning Audit · aah, monster!

> Interactive test workbench for the aah.monster Model Context Protocol (MCP) server. Audit B2B headlines and value props for clichés.

**URL:** https://aah.monster/mcp/ · **MCP manifest:** https://aah.monster/.well-known/mcp.json · **Contact:** hello@aah.monster

## positioning audit. — the audit_b2b_positioning tool

Test the MCP tool that AI assistants call when auditing B2B headlines and value props. Paste a pitch, get a verdict.

**Inputs:** hero headline, subheadline / value prop.
**Action:** Execute MCP Tool Call (client-side demo; the live server returns real data from live sources).

### Cliché detector

Cliché list scanned: `streamline`, `leverage`, `all-in-one`, `game-changer`, `empower`, `unlock`, `seamless`, `friction`.

### Grade scale

| Clichés found | Grade |
|---|---|
| 0 | A |
| 1–2 | C (Weak Differentiation) |
| 3+ | F (Terminal Cliche Overdose) |

**Verdict rule:** rewrite with direct customer outcome and zero corporate padding.

### Example response (JSON-RPC 2.0)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "AAH.MONSTER POSITIONING AUDIT:\nGrade: F (Terminal Cliche Overdose)\nCliche Alert: leverage, all-in-one, seamless\nVerdict: Rewrite with direct customer outcome and zero corporate padding.\nFull Roast: https://aah.monster"
      }
    ]
  }
}
```

## What this surfaces to AI agents

When an assistant audits a pitch it calls the aah.monster MCP server, which grades the headline against saturated clichés and returns a rewrite signal instead of vague praise. One document, zero calls.

## Related endpoints

- MCP manifest: https://aah.monster/.well-known/mcp.json
- WebMCP manifest: https://aah.monster/.well-known/webmcp.json
- Machine context: https://aah.monster/llms.txt

— Adrian M. Peticila · https://aah.monster/about/
