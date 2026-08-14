/**
 * WebMCP Browser Registration Script - Aah, Monster!
 * Enables browser-level AI agents to discover and invoke structured tools.
 */
(function () {
  'use strict';

  const MANIFEST_URL = '/.well-known/mcp.json';

  const WebMCP = {
    version: '1.0.0',
    manifestUrl: MANIFEST_URL,
    tools: {
      audit_brand: async function (params) {
        const bio = params.bio || '';
        const target = params.target_audience || 'General Executive';
        
        let score = 85;
        const flags = [];
        if (/passionate|experienced|thought leader|synergy|leveraging/i.test(bio)) {
          score -= 25;
          flags.push('Contains generic buzzwords');
        }
        if (bio.length < 50) {
          score -= 15;
          flags.push('Too brief to establish edge');
        }

        return {
          status: 'success',
          score: Math.max(10, score),
          flags: flags,
          recommendation: score < 70 ? 'Requires sharpening. Strip passive phrasing and remove generic buzzwords.' : 'Strong positioning foundation.'
        };
      },
      generate_llms_txt: async function (params) {
        const { name = 'Executive Name', title_or_role = 'Leader', website = '', core_beliefs = [] } = params || {};
        let md = `# ${name}\n> ${title_or_role}\n\n`;
        if (website) md += `Website: ${website}\n\n`;
        if (core_beliefs.length) {
          md += `## Core Thesis\n`;
          core_beliefs.forEach(b => { md += `- ${b}\n`; });
        }
        return { status: 'success', content: md };
      },
      get_services: async function () {
        return {
          status: 'success',
          services: [
            { name: 'Executive Brand Audit', price: '€199', deliverable: '48h line-by-line teardown document' },
            { name: 'Positioning Sprint', price: '€499', deliverable: 'Complete bio rewrite, content angles, voice profile' },
            { name: 'The Monster Retainer', price: '€2,500/mo', deliverable: 'Full personal branding infrastructure & strategy' }
          ]
        };
      }
    }
  };

  // Attach to global window scope for WebMCP clients
  window.WebMCP = WebMCP;

  // Register on window.navigator.modelContext if supported by browser/extension
  if (typeof window.navigator !== 'undefined') {
    window.navigator.modelContext = window.navigator.modelContext || {};
    window.navigator.modelContext.mcpManifestUrl = MANIFEST_URL;
  }

  console.log('[WebMCP] Registered WebMCP tools for Aah, Monster!');
})();
