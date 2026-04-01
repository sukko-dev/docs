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

  const seen = new Set();
  for (const cmd of data.commands) {
    if (seen.has(cmd.use)) continue;
    seen.add(cmd.use);

    md += `### \`sukko ${mdxSafe(cmd.use)}\`\n\n`;
    md += `${mdxSafe(cmd.short)}\n\n`;
    if (cmd.long) md += `${mdxSafe(cmd.long)}\n\n`;
    if (cmd.aliases && cmd.aliases.length > 0) {
      md += `**Aliases:** ${cmd.aliases.map(a => `\`${a}\``).join(', ')}\n\n`;
    }
    if (cmd.example) {
      md += '**Example:**\n\n```bash\n' + cmd.example + '\n```\n\n';
    }
    md += '---\n\n';
  }

  const outPath = path.join(DOCS_DIR, 'reference', 'cli.mdx');
  fs.writeFileSync(outPath, md);
  console.log(`  cli-reference: ${seen.size} commands`);
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

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('Generating reference docs from extracted JSON...');
generateConfigReference();
generateCLIReference();
generateSDKReference();
console.log('Done.');
