#!/usr/bin/env node

// Pre-build script: generates MDX reference pages from extracted JSON.
// Run before `npm run build` or `npm start`.
//
// Usage: node scripts/generate-docs.js

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const GEN_DIR = path.join(__dirname, '..', 'generated');

// Escape angle brackets in text that's outside code blocks/backticks for MDX safety
function mdxSafe(str) {
  if (!str) return '';
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Config Reference ─────────────────────────────────────────────────────────

const SERVICE_ORDER = ['base', 'gateway', 'server', 'provisioning', 'tester'];
const SERVICE_LABELS = {
  base: 'Shared (Base)',
  gateway: 'ws-gateway',
  server: 'ws-server',
  provisioning: 'Provisioning',
  tester: 'Tester',
};

function generateConfigReference() {
  const jsonPath = path.join(GEN_DIR, 'config-reference.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('  skip config-reference (no JSON)');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const sorted = [...data.services].sort(
    (a, b) => SERVICE_ORDER.indexOf(a.name) - SERVICE_ORDER.indexOf(b.name),
  );

  let md = `---
title: Configuration Reference
description: All environment variables across Sukko services
---

# Configuration Reference

All configurable environment variables across Sukko services. Values are set via \`env:\` struct tags in Go config files — the \`envDefault\` is the source of truth for defaults.

`;

  for (const svc of sorted) {
    const label = SERVICE_LABELS[svc.name] || svc.name;
    md += `## ${label}\n\n`;
    md += '| Variable | Type | Default | Description |\n';
    md += '|----------|------|---------|-------------|\n';
    for (const v of svc.vars) {
      const def = v.default ? `\`${v.default}\`` : '—';
      const desc = mdxSafe((v.description || '').replace(/\n/g, ' ').replace(/\|/g, '\\|'));
      md += `| \`${v.name}\` | ${v.type} | ${def} | ${desc} |\n`;
    }
    md += '\n';
  }

  const outPath = path.join(DOCS_DIR, 'reference', 'configuration.mdx');
  fs.writeFileSync(outPath, md);
  console.log(`  config-reference: ${data.services.reduce((n, s) => n + s.vars.length, 0)} vars`);
}

// ─── CLI Reference ────────────────────────────────────────────────────────────

function generateCLIReference() {
  const jsonPath = path.join(GEN_DIR, 'cli-reference.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('  skip cli-reference (no JSON)');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  let md = `---
title: CLI Reference
description: Every sukko CLI command with usage and flags
---

# CLI Reference

The \`sukko\` CLI manages your Sukko deployment — tenants, keys, testing, and local development.

## Install

\`\`\`bash
# macOS / Linux
brew install klurvio/tap/sukko

# Windows
scoop bucket add sukko https://github.com/klurvio/scoop-bucket
scoop install sukko
\`\`\`

## Commands

`;

  // gendocs outputs a tree: root command with children (nested subcommands)
  // Support both old format (flat .commands array) and new format (single root with .children)
  const commands = data.commands || (data.children ? data.children : []);
  let count = 0;

  function renderCommand(cmd, prefix) {
    const fullName = prefix ? `${prefix} ${cmd.name}` : cmd.name;
    md += `### \`sukko ${mdxSafe(cmd.use || cmd.name)}\`\n\n`;
    md += `${mdxSafe(cmd.short)}\n\n`;
    if (cmd.long) md += `${mdxSafe(cmd.long)}\n\n`;
    if (cmd.aliases && cmd.aliases.length > 0) {
      md += `**Aliases:** ${cmd.aliases.map(a => `\`${a}\``).join(', ')}\n\n`;
    }
    if (cmd.flags && cmd.flags.length > 0) {
      md += '**Flags:**\n\n';
      md += '| Flag | Type | Default | Description |\n';
      md += '|------|------|---------|-------------|\n';
      for (const f of cmd.flags) {
        const name = f.shorthand ? `\`--${f.name}\`, \`-${f.shorthand}\`` : `\`--${f.name}\``;
        md += `| ${name} | ${f.type} | ${f.default ? `\`${mdxSafe(f.default)}\`` : '—'} | ${mdxSafe(f.usage)} |\n`;
      }
      md += '\n';
    }
    if (cmd.example) {
      md += '**Example:**\n\n```bash\n' + cmd.example + '\n```\n\n';
    }
    md += '---\n\n';
    count++;

    // Recurse into subcommands
    if (cmd.children) {
      for (const child of cmd.children) {
        renderCommand(child, fullName);
      }
    }
  }

  for (const cmd of commands) {
    renderCommand(cmd, 'sukko');
  }

  const outPath = path.join(DOCS_DIR, 'reference', 'cli.mdx');
  fs.writeFileSync(outPath, md);
  console.log(`  cli-reference: ${count} commands`);
}

// ─── SDK Reference ────────────────────────────────────────────────────────────

const PACKAGE_FILES = {
  '@sukko/sdk': 'reference/sdk/core.mdx',
  '@sukko/websocket': 'reference/sdk/websocket.mdx',
  '@sukko/react': 'reference/sdk/react.mdx',
  '@sukko/vue': 'reference/sdk/vue.mdx',
  '@sukko/svelte': 'reference/sdk/svelte.mdx',
};

const PACKAGE_LABELS = {
  '@sukko/sdk': 'Core SDK',
  '@sukko/websocket': 'WebSocket Transport',
  '@sukko/react': 'React Hooks',
  '@sukko/vue': 'Vue Composables',
  '@sukko/svelte': 'Svelte Stores',
};

function generateSDKReference() {
  const jsonPath = path.join(GEN_DIR, 'sdk-reference.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('  skip sdk-reference (no JSON)');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const kinds = ['class', 'function', 'type', 'constant'];
  const kindLabels = { class: 'Classes', function: 'Functions', type: 'Types', constant: 'Constants' };

  for (const pkg of data.packages) {
    const file = PACKAGE_FILES[pkg.name];
    if (!file) continue;

    const label = PACKAGE_LABELS[pkg.name] || pkg.name;
    let md = `---
title: "${label}"
description: "${pkg.name} API reference"
---

# ${label}

\`\`\`bash
npm install ${pkg.name}
\`\`\`

`;

    const seen = new Set();
    const unique = pkg.exports.filter(e => {
      if (seen.has(e.name)) return false;
      seen.add(e.name);
      return true;
    });

    for (const kind of kinds) {
      const items = unique.filter(e => e.kind === kind);
      if (items.length === 0) continue;

      md += `## ${kindLabels[kind]}\n\n`;
      for (const item of items) {
        md += `### \`${mdxSafe(item.signature)}\`\n\n`;
        if (item.parameters) md += `**Parameters:** \`${mdxSafe(item.parameters)}\`\n\n`;
        if (item.returnType) md += `**Returns:** \`${mdxSafe(item.returnType)}\`\n\n`;
        md += '---\n\n';
      }
    }

    const outPath = path.join(DOCS_DIR, file);
    fs.writeFileSync(outPath, md);
    console.log(`  sdk-reference: ${pkg.name} (${unique.length} exports)`);
  }
}

// ─── Editions Comparison ──────────────────────────────────────────────────────

function formatLimit(value) {
  if (value === 0) return 'Unlimited';
  return value.toLocaleString();
}

function generateEditionsComparison() {
  const jsonPath = path.join(GEN_DIR, 'editions.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('  skip editions (no JSON)');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Normalize feature names to human-readable labels
  const featureLabels = {
    'MESSAGE_BACKEND=kafka': 'Kafka/Redpanda Backend',
    'MESSAGE_BACKEND=nats': 'NATS JetStream Backend',
    'DATABASE_DRIVER=postgres': 'PostgreSQL for Provisioning',
    'SSE transport': 'SSE Transport',
    'GATEWAY_PER_TENANT_CHANNEL_RULES': 'Per-Tenant Channel Rules',
    'TENANT_CONNECTION_LIMIT_ENABLED': 'Per-Tenant Connection Limits',
    'per-tenant configurable quotas': 'Per-Tenant Configurable Quotas',
    'tenant lifecycle manager': 'Tenant Lifecycle Manager',
    'ALERT_ENABLED': 'Alerting (AlertManager)',
    'real-time analytics': 'Real-Time Analytics',
    'connection tracing': 'Connection Tracing (OpenTelemetry)',
    'admin UI': 'Admin UI',
    'token revocation': 'Token Revocation',
    'webhook delivery': 'Webhook Delivery',
    'message history': 'Message History',
    'channel patterns (CEL)': 'Channel Patterns (CEL)',
    'delta compression': 'Delta Compression',
    'Web Push transport': 'Web Push Transport',
    'admin UI SSO/OIDC': 'Admin UI SSO/OIDC',
    'per-tenant IP allowlisting': 'Per-Tenant IP Allowlisting',
    'audit logging': 'Audit Logging',
    'end-to-end encryption': 'End-to-End Encryption',
    'priority message routing': 'Priority Message Routing',
    'custom quota policies': 'Custom Quota Policies',
  };

  function featureLabel(name) {
    return featureLabels[name] || name;
  }

  const editions = {};
  for (const e of data.editions) {
    editions[e.edition] = e;
  }

  const c = editions['community'] || {};
  const p = editions['pro'] || {};
  const e = editions['enterprise'] || {};

  let md = `---
title: Edition Comparison
description: Compare Sukko Community, Pro, and Enterprise editions
---

import EditionBadge from '@site/src/components/EditionBadge';

# Edition Comparison

Sukko is available in three editions. Community is free — no license key required. Pro and Enterprise unlock higher limits and advanced features via a license key.

## Limits

| Resource | Community | Pro | Enterprise |
|----------|-----------|-----|------------|
| **Tenants** | ${formatLimit(c.max_tenants)} | ${formatLimit(p.max_tenants)} | ${formatLimit(e.max_tenants)} |
| **Total Connections** | ${formatLimit(c.max_total_connections)} | ${formatLimit(p.max_total_connections)} | ${formatLimit(e.max_total_connections)} |
| **Shards** | ${formatLimit(c.max_shards)} | ${formatLimit(p.max_shards)} | ${formatLimit(e.max_shards)} |
| **Topics per Tenant** | ${formatLimit(c.max_topics_per_tenant)} | ${formatLimit(p.max_topics_per_tenant)} | ${formatLimit(e.max_topics_per_tenant)} |
| **Routing Rules per Tenant** | ${formatLimit(c.max_routing_rules_per_tenant)} | ${formatLimit(p.max_routing_rules_per_tenant)} | ${formatLimit(e.max_routing_rules_per_tenant)} |

## Feature Gates

| Feature | Community | Pro | Enterprise |
|---------|-----------|-----|------------|
`;

  // Auto-generate feature rows from extracted data
  const features = data.features || [];
  const proFeatures = features.filter(f => f.edition === 'pro');
  const enterpriseFeatures = features.filter(f => f.edition === 'enterprise');

  const implProFeatures = proFeatures.filter(f => f.implemented);
  const comingSoonProFeatures = proFeatures.filter(f => !f.implemented);
  const implEntFeatures = enterpriseFeatures.filter(f => f.implemented);
  const comingSoonEntFeatures = enterpriseFeatures.filter(f => !f.implemented);

  for (const f of implProFeatures) {
    md += `| **${mdxSafe(featureLabel(f.name))}** | — | Yes | Yes |\n`;
  }
  for (const f of implEntFeatures) {
    md += `| **${mdxSafe(featureLabel(f.name))}** | — | — | Yes |\n`;
  }

  if (comingSoonProFeatures.length > 0 || comingSoonEntFeatures.length > 0) {
    md += `\n## Coming Soon\n\n`;
    md += `| Feature | Edition |\n`;
    md += `|---------|----------|\n`;
    for (const f of comingSoonProFeatures) {
      md += `| ${mdxSafe(featureLabel(f.name))} | Pro |\n`;
    }
    for (const f of comingSoonEntFeatures) {
      md += `| ${mdxSafe(featureLabel(f.name))} | Enterprise |\n`;
    }
  }

  md += `

## Which Edition Do I Need?

### Community (Free)

For evaluation, development, and small deployments. No license key required.

- Up to ${formatLimit(c.max_tenants)} tenants, ${formatLimit(c.max_total_connections)} connections
- All core features (gateway, multi-tenant, JWT auth, Kafka)
- Community support via GitHub Issues

### Pro <EditionBadge edition="pro" />

For production workloads with multiple tenants and higher scale.

- Up to ${formatLimit(p.max_tenants)} tenants, ${formatLimit(p.max_total_connections)} connections
- Advanced features: dedicated consumers, alerting, TLS, tracing
- Email support

### Enterprise <EditionBadge edition="enterprise" />

For large-scale deployments with no limits.

- Unlimited everything
- Priority support with custom SLA
- Contact us for pricing

## Next Steps

- **[Upgrade to Pro](./upgrade)** — Set your license key and unlock Pro features
- **[Pricing](./pricing)** — Pricing details
- **[Quickstart](../quickstart)** — Try Sukko with the free Community edition
`;

  const outPath = path.join(DOCS_DIR, 'editions', 'comparison.mdx');
  fs.writeFileSync(outPath, md);
  console.log(`  editions: ${data.editions.length} editions`);
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────

const priorityLabels = {
  2: 'High Priority',
  3: 'Medium Priority',
  4: 'Low Priority',
  5: 'Future',
};

function generateRoadmap() {
  const jsonPath = path.join(GEN_DIR, 'editions.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('  skip roadmap (no JSON)');
    return;
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const features = (data.features || []).filter(f => f.status === 'future' && f.priority >= 2);

  if (features.length === 0) {
    console.log('  skip roadmap (no future features)');
    return;
  }

  // Group by priority
  const groups = {};
  for (const f of features) {
    const p = f.priority;
    if (!groups[p]) groups[p] = [];
    groups[p].push(f);
  }

  let md = `---
title: Roadmap
description: Upcoming features planned for Sukko
---

# Roadmap

Planned features for upcoming Sukko releases. This page is auto-generated from the feature matrix in the Sukko source code.

Have feedback or feature requests? Join the discussion on [GitHub Discussions](https://github.com/klurvio/sukko-issues/discussions).

`;

  const sortedPriorities = Object.keys(groups).map(Number).sort();

  for (const p of sortedPriorities) {
    const label = priorityLabels[p] || `Priority ${p}`;
    md += `## ${label}\n\n`;
    md += '| Feature | Edition | Description |\n';
    md += '|---------|---------|-------------|\n';

    for (const f of groups[p]) {
      const edition = f.edition === 'pro' ? 'Pro' : 'Enterprise';
      md += `| **${mdxSafe(featureLabel(f.name))}** | ${edition} | ${mdxSafe(f.description)} |\n`;
    }
    md += '\n';
  }

  md += `---

*This roadmap is auto-generated from the [feature matrix](https://github.com/klurvio/sukko) in the Sukko source code. Priorities may change based on community feedback.*
`;

  const outPath = path.join(DOCS_DIR, 'roadmap.mdx');
  fs.writeFileSync(outPath, md);
  console.log(`  roadmap: ${features.length} planned features`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('Generating reference docs from extracted JSON...');
generateConfigReference();
generateCLIReference();
generateSDKReference();
generateEditionsComparison();
generateRoadmap();
console.log('Done.');
