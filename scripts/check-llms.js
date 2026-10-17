#!/usr/bin/env node

// Post-build check: validate static/llms.txt against the built site and the
// sidebar. This closes the gap that let the index drift undetected — the
// Docusaurus link checker (onBrokenLinks / lychee) never looks inside a .txt
// static file, so broken /docs/* paths shipped silently.
//
// Two assertions:
//   1. Every internal link in build/llms.txt resolves to a real file in build/.
//   2. The set of /docs/<id> links matches the set of sidebar page ids exactly
//      (nothing in the sidebar is missing from the index, and vice versa).
//
// Run after `npm run build` (which produces build/ including build/llms.txt).
// Usage: node scripts/check-llms.js

const fs = require('fs');
const path = require('path');
const { loadSidebar, ROUTE_BASE, SITE } = require('./generate-llms.js');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const LLMS = path.join(BUILD, 'llms.txt');

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(msg, items) {
  console.error(`check-llms: ${msg}`);
  for (const i of items || []) console.error(`  - ${i}`);
  process.exit(1);
}

if (!fs.existsSync(LLMS)) {
  fail(`build/llms.txt not found — run \`npm run build\` first (it runs generate-llms)`, []);
}

const content = fs.readFileSync(LLMS, 'utf8');

// Collect links to check against the built site. Internal markdown links
// ([text](/path)) plus any absolute link to our own origin, anywhere in the
// file — including the `## Links` section, which carries the Documentation and
// OpenAPI URLs and is exactly where a bad base would hide from a relative-only
// check.
const siteLinks = []; // site-relative paths ('' = origin root)
for (const m of content.matchAll(/\]\((\/[^)]*)\)/g)) siteLinks.push(m[1]);
for (const m of content.matchAll(new RegExp(escapeRe(SITE) + '(/[^\\s)]*|\\b)', 'g'))) {
  siteLinks.push(m[1] || '/');
}

// 1. Every such link resolves to a built file. Docusaurus emits clean URLs
// (/docs/quickstart -> build/docs/quickstart/index.html); the origin root maps
// to build/index.html; a path with a file extension (e.g. /openapi.yaml) maps
// to that file verbatim.
const missing = [];
for (const href of siteLinks) {
  const rel = href.replace(/^\//, '').replace(/\/$/, '');
  let target;
  if (rel === '') target = path.join(BUILD, 'index.html');
  else if (path.extname(rel) !== '') target = path.join(BUILD, rel);
  else target = path.join(BUILD, rel, 'index.html');
  if (!fs.existsSync(target)) missing.push(`${href}  (expected ${path.relative(ROOT, target)})`);
}
if (missing.length) fail(`${missing.length} link(s) in llms.txt do not resolve in the built site:`, missing);

// internal /docs links drive the sidebar-parity check below.
const internalLinks = siteLinks.filter((h) => h.startsWith('/'));

// 2. Sidebar parity. Flatten every page id the sidebar references.
function flatten(items, acc) {
  for (const it of items) {
    if (typeof it === 'string') acc.push(it);
    else if (it && it.type === 'category') flatten(it.items, acc);
  }
  return acc;
}
const sidebarIds = new Set(flatten(loadSidebar(), []));

const indexedIds = new Set();
for (const href of internalLinks) {
  const base = ROUTE_BASE + '/';
  if (href.startsWith(base)) indexedIds.add(href.slice(base.length).replace(/\/$/, ''));
}

const notIndexed = [...sidebarIds].filter((id) => !indexedIds.has(id));
if (notIndexed.length) fail(`sidebar pages missing from llms.txt:`, notIndexed);

const notInSidebar = [...indexedIds].filter((id) => !sidebarIds.has(id));
if (notInSidebar.length) fail(`llms.txt lists /docs pages absent from the sidebar:`, notInSidebar);

console.log(
  `check-llms: OK — ${internalLinks.length} internal link(s) resolve, ${sidebarIds.size} sidebar page(s) indexed`
);
