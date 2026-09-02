/**
 * WebMCP Browser Registration Script - Aah, Monster!
 * Enables browser-level AI agents to discover and invoke structured tools.
 */
(function () {
  'use strict';

  const MANIFEST_URL = '/.well-known/webmcp';

  const VIRAL_TEMPLATES = [
    {
      id: 'contrarian_truth',
      category: 'contrarian_opinion',
      title: 'The Uncomfortable Truth',
      structure: '1. Bold contrarian opening.\n2. Why the conventional advice fails.\n3. The real mechanism.\n4. Tactical rule.',
      example_hook: 'Most personal branding advice is just corporate PR dressed up as authenticity.'
    },
    {
      id: 'failure_dissection',
      category: 'failure_story',
      title: 'Post-Mortem Teardown',
      structure: '1. The mistake and exact cost.\n2. The flawed assumption.\n3. The turning point.\n4. What changed permanently.',
      example_hook: 'We lost EUR 40k testing what the market claimed they wanted.'
    },
    {
      id: 'framework_breakdown',
      category: 'framework_breakdown',
      title: 'Monster Positioning Engine',
      structure: '1. The problem with vague positioning.\n2. The 3 core pillars.\n3. Implementation steps.\n4. The expected shift.',
      example_hook: 'If your bio needs three sentences to explain what you do, you do nothing distinct.'
    },
    {
      id: 'metric_teardown',
      category: 'metric_teardown',
      title: 'Metrics vs Reality',
      structure: '1. Vanity metric vs cash metric.\n2. Where founders deceive themselves.\n3. The one KPI that mattered.\n4. How to track it.',
      example_hook: '100k views generated 0 pipeline. Here is the math that fixed it.'
    }
  ];

  const SERVICES = [
    {
      id: 'audit',
      name: 'Executive Brand Audit',
      price: 'EUR 199',
      deliverable: '48h line-by-line teardown document, positioning gaps, anti-AI tone check.'
    },
    {
      id: 'sprint',
      name: 'Positioning Sprint',
      price: 'EUR 499',
      deliverable: 'Complete bio rewrite, 10 core content angles, custom voice operating manual.'
    },
    {
      id: 'retainer',
      name: 'The Monster Retainer',
      price: 'EUR 2,500/mo',
      deliverable: 'Full personal branding infrastructure, ghostwriting, async execution, zero calls.'
    }
  ];

  const WebMCP = {
    version: '1.0.0',
    manifestUrl: MANIFEST_URL,
    tools: {
      analyze_hook: async function (params) {
        const { hook = '', format = 'text', platform = 'linkedin' } = params || {};
        if (!hook.trim()) {
          return { status: 'error', message: 'Hook text is required.' };
        }

        let score = 75;
        const feedback = [];
        const suggestions = [];

        if (hook.length < 20) {
          score -= 20;
          feedback.push('Hook is too brief to build anticipation.');
          suggestions.push('Add context or a sharp contrast to set up the premise.');
        } else if (hook.length > 140) {
          score -= 15;
          feedback.push('Hook is too verbose for modern feeds.');
          suggestions.push('Trim filler words and front-load the punchline.');
        } else {
          score += 10;
          feedback.push('Optimal character length for feed truncation.');
        }

        if (/passionate|excited to share|thrilled|proud to announce|synergy|leverage|game-changer/i.test(hook)) {
          score -= 30;
          feedback.push('Contains corporate or AI cliches.');
          suggestions.push('Replace announcement framing with a direct observation or contrarian stance.');
        }

        if (/\d+/.test(hook)) {
          score += 10;
          feedback.push('Includes specific quantitative data or metrics.');
        }

        if (/\?$/.test(hook.trim())) {
          feedback.push('Question hook: effective only if provocative, not rhetorical.');
          suggestions.push('Consider converting the question into a declarative, polar statement.');
        }

        const finalScore = Math.max(10, Math.min(100, score));
        return {
          status: 'success',
          hook: hook,
          platform: platform,
          format: format,
          score: finalScore,
          rating: finalScore >= 80 ? 'High Impact' : finalScore >= 60 ? 'Moderate' : 'Needs Rework',
          feedback: feedback,
          suggestions: suggestions
        };
      },

      generate_post: async function (params) {
        const {
          topic = '',
          target_audience = 'Founders and C-Suite',
          tone = 'sharp and contrarian',
          format = 'short-form'
        } = params || {};

        if (!topic.trim()) {
          return { status: 'error', message: 'Topic is required.' };
        }

        const draft = [
          `Most leaders get ${topic} completely wrong.`,
          '',
          `They treat it like a checkbox instead of an asymmetric lever for ${target_audience}.`,
          '',
          'Three rules to cut through the noise:',
          `1. Differentiate by subtraction: eliminate whatever everyone else repeats about ${topic}.`,
          '2. Proof beats polish: replace abstract claims with real, verifiable receipts.',
          '3. Stand for an explicit outcome: vague promises build zero conviction.',
          '',
          `The outcome: a distinct edge while your market stays forgettable.`
        ].join('\n');

        return {
          status: 'success',
          topic: topic,
          target_audience: target_audience,
          tone: tone,
          format: format,
          draft: draft,
          guidelines_applied: [
            'Zero corporate cliches',
            'No em-dashes',
            'High contrast phrasing',
            'Direct declarative cadence'
          ]
        };
      },

      get_viral_templates: async function (params) {
        const { category = 'all' } = params || {};
        const filtered = (category === 'all' || !category)
          ? VIRAL_TEMPLATES
          : VIRAL_TEMPLATES.filter(t => t.category === category || t.id === category);

        return {
          status: 'success',
          total: filtered.length,
          templates: filtered
        };
      },

      audit_brand: async function (params) {
        const bio = (params && params.bio) || '';
        const target = (params && params.target_audience) || 'General Executive';

        let score = 85;
        const flags = [];
        if (/passionate|experienced|thought leader|synergy|leveraging|dynamic|proven track record/i.test(bio)) {
          score -= 25;
          flags.push('Contains generic buzzwords or corporate fluff');
        }
        if (bio.length < 50) {
          score -= 15;
          flags.push('Too brief to establish distinct edge');
        }
        if (!/\b(helped|built|scaled|generated|led|advised|founded|authored)\b/i.test(bio)) {
          score -= 10;
          flags.push('Lacks concrete operational verbs');
        }

        const finalScore = Math.max(10, Math.min(100, score));
        return {
          status: 'success',
          target_audience: target,
          score: finalScore,
          flags: flags,
          recommendation: finalScore < 70
            ? 'Requires sharpening. Strip passive phrasing, kill corporate cliches, and ground claims in verifiable outcomes.'
            : 'Strong positioning foundation. Ensure consistent tone across every touchpoint.'
        };
      },

      generate_llms_txt: async function (params) {
        const {
          name = 'Executive Name',
          title_or_role = 'Leader',
          website = '',
          core_beliefs = [],
          key_achievements = []
        } = params || {};

        let md = `# ${name}\n> ${title_or_role}\n\n`;
        if (website) md += `Website: ${website}\n\n`;

        if (Array.isArray(core_beliefs) && core_beliefs.length > 0) {
          md += `## Core Thesis\n`;
          core_beliefs.forEach(b => { md += `- ${b}\n`; });
          md += '\n';
        }

        if (Array.isArray(key_achievements) && key_achievements.length > 0) {
          md += `## Key Achievements\n`;
          key_achievements.forEach(a => { md += `- ${a}\n`; });
          md += '\n';
        }

        return { status: 'success', content: md };
      },

      get_services: async function (params) {
        const packageType = (params && params.package_type) || 'all';
        const filtered = (packageType === 'all' || !packageType)
          ? SERVICES
          : SERVICES.filter(s => s.id === packageType);

        return {
          status: 'success',
          filter: packageType,
          services: filtered
        };
      }
    }
  };

  // Attach to global window scope for WebMCP clients
  window.WebMCP = WebMCP;

  // Register on window.navigator.modelContext if supported by browser or extension
  if (typeof window.navigator !== 'undefined') {
    window.navigator.modelContext = window.navigator.modelContext || {};
    window.navigator.modelContext.mcpManifestUrl = MANIFEST_URL;
  }

  console.log('[WebMCP] Registered WebMCP tools for Aah, Monster!');
})();
