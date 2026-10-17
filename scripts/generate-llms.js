#!/usr/bin/env node

// Pre-build script: generates static/llms.txt — the LLM discovery index for the
// docs site (https://llmstxt.org). The index is NOT hand-maintained: it is
// derived from sidebars.ts (structure + page order) and each page's frontmatter
// (title + description), so adding a page to the sidebar is all it takes to have
// it appear here. Run as part of `npm run generate` (after generate-docs.js, so
// the generated reference/editions/roadmap pages exist on disk to read).
//
// Links point at /docs/<id> because the docs plugin serves under
// routeBasePath: 'docs' (see docusaurus.config.ts). The companion check-llms.js
// asserts every generated link resolves in the built site.
//
// Usage: node scripts/generate-llms.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const SIDEBARS = path.join(ROOT, 'sidebars.ts');
const OUT = path.join(ROOT, 'static', 'llms.txt');

// The docs plugin serves every page under this base (routeBasePath: 'docs').
const ROUTE_BASE = '/docs';

// The deployed docs origin (docusaurus.config.ts `url`). The site root is the
// React landing page (src/pages/index.tsx), not a docs page, so the
// Documentation link points at the origin root, not ROUTE_BASE.
const SITE = 'https://docs.sukko.dev';

// External links. These are stable repo/site URLs, not page-derived, so they
// live here rather than in a doc page's frontmatter.
const LINKS = [
  ['Website', 'https://sukko.dev'],
  ['Documentation', SITE],
  ['OpenAPI spec', SITE + '/openapi.yaml'],
  ['CLI', 'https://github.com/sukko-dev/cli'],
  ['JS SDK', 'https://github.com/sukko-dev/sdk-js'],
  ['Python SDK', 'https://github.com/sukko-dev/sdk-py'],
  ['Issues', 'https://github.com/sukko-dev/sukko'],
];

// Load sidebars.ts without a TypeScript runtime: the file is a plain data
// module (one typed object literal, a type-only import, and a default export).
// Stripping the type annotation and rewriting the export is enough to evaluate
// it as CommonJS, and it works in every environment (local dev, CI, link-check)
// with zero extra dependencies. loadSidebar throws loudly if the shape changes.
function loadSidebar() {
  let src = fs.readFileSync(SIDEBARS, 'utf8');
  src = src
    .replace(/^\s*import[^;]*;\s*$/gm, '') // drop import lines (type-only here)
    .replace(/:\s*SidebarsConfig\b/g, '') // drop the type annotation
    .replace(/\bsatisfies\s+[A-Za-z0-9_.]+/g, '') // defensive: strip `satisfies X`
    .replace(/export\s+default\s+(\w+)\s*;?/g, 'module.exports = $1;');
  const mod = { exports: {} };
  new Function('module', 'exports', src)(mod, mod.exports);
  const config = mod.exports;
  if (!config || !Array.isArray(config.docsSidebar)) {
    throw new Error('generate-llms: could not load docsSidebar from sidebars.ts — the file shape changed');
  }
  return config.docsSidebar;
}

// Parse a page's frontmatter for the handful of scalar fields we need. A full
// YAML parser is overkill: frontmatter here is flat `key: value` pairs.
function frontmatter(id) {
  for (const ext of ['.mdx', '.md']) {
    const p = path.join(DOCS_DIR, id + ext);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const fm = { _body: text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') };
    if (m) {
      for (const line of m[1].split(/\r?\n/)) {
        const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
        if (kv) fm[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '').trim();
      }
    }
    return fm;
  }
  throw new Error(`generate-llms: no page file on disk for sidebar id "${id}" (looked for docs/${id}.mdx|.md)`);
}

function titleFor(id) {
  const fm = frontmatter(id);
  return fm.title || id.split('/').pop().replace(/[-_]/g, ' ');
}

function descFor(id) {
  return frontmatter(id).description || '';
}

function link(id) {
  const t = titleFor(id);
  const d = descFor(id);
  return `- [${t}](${ROUTE_BASE}/${id})${d ? ': ' + d : ''}`;
}

// Build the blockquote summary from the home page's first body paragraph
// (richer than its frontmatter description), with markdown emphasis stripped.
function summary() {
  const fm = frontmatter('index');
  const para = (fm._body || '')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))[0];
  const text = (para || fm.description || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/[*_`]/g, '').trim();
  return text;
}

function render() {
  const sidebar = loadSidebar();
  const out = [];
  out.push('# Sukko Documentation');
  out.push('');
  out.push(`> ${summary()}`);
  out.push('');

  for (const item of sidebar) {
    if (typeof item === 'string') {
      // A loose top-level page becomes its own single-entry section.
      out.push(`## ${titleFor(item)}`);
      out.push('');
      out.push(link(item));
      out.push('');
    } else if (item.type === 'category') {
      out.push(`## ${item.label}`);
      out.push('');
      // Direct pages first, then nested sub-categories, so loose pages are
      // never visually absorbed into a preceding subsection.
      const pages = item.items.filter((i) => typeof i === 'string');
      const subs = item.items.filter((i) => i && i.type === 'category');
      for (const id of pages) out.push(link(id));
      if (pages.length) out.push('');
      for (const sub of subs) {
        out.push(`### ${sub.label}`);
        out.push('');
        for (const i of sub.items) {
          if (typeof i === 'string') out.push(link(i));
        }
        out.push('');
      }
    }
  }

  out.push('## Links');
  out.push('');
  for (const [label, url] of LINKS) out.push(`- ${label}: ${url}`);
  out.push('');

  return out.join('\n');
}

function write() {
  const content = render();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, content);
  const lineCount = content.split('\n').length;
  console.log(`generate-llms: wrote ${path.relative(ROOT, OUT)} (${lineCount} lines)`);
}

module.exports = { loadSidebar, render, ROUTE_BASE, SITE, OUT };

if (require.main === module) {
  write();
}
