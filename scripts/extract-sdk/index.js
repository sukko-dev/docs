#!/usr/bin/env node

// Extract SDK reference from sukko-js TypeScript packages.
//
// Produces a simplified reference by regex-parsing each package's index.ts
// (and the local files it re-exports) for exported types, functions, classes,
// and constants. A future improvement could replace this with a TypeScript
// compiler API-based extractor.
//
// Usage: node index.js /path/to/sukko-js

const fs = require('fs');
const path = require('path');

const packages = [
  { name: '@sukko/sdk', dir: 'packages/sdk' },
  { name: '@sukko/websocket', dir: 'packages/websocket' },
  { name: '@sukko/react', dir: 'packages/react' },
  { name: '@sukko/vue', dir: 'packages/vue' },
  { name: '@sukko/svelte', dir: 'packages/svelte' },
];

function extractExports(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const exports = [];

  // Match: export function name(...): type
  const funcRegex = /export\s+function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^\n{;]+))?/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      kind: 'function',
      signature: `${match[1]}(${match[3].trim()})${match[4] ? ': ' + match[4].trim() : ''}`,
      parameters: match[3].trim() || undefined,
      returnType: match[4] ? match[4].trim() : undefined,
    });
  }

  // Match: export interface/type Name
  const typeRegex = /export\s+(?:interface|type)\s+(\w+)\s*(<[^>]*>)?/g;
  while ((match = typeRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      kind: 'type',
      signature: `${match[1]}${match[2] || ''}`,
    });
  }

  // Match: export class Name
  const classRegex = /export\s+class\s+(\w+)\s*(<[^>]*>)?/g;
  while ((match = classRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      kind: 'class',
      signature: `${match[1]}${match[2] || ''}`,
    });
  }

  // Match: export const name
  const constRegex = /export\s+const\s+(\w+)\s*(?::\s*([^\n=]+))?\s*=/g;
  while ((match = constRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      kind: 'constant',
      signature: match[1],
      returnType: match[2] ? match[2].trim() : undefined,
    });
  }

  return exports;
}

// Discover the local files re-exported by a barrel's index content.
// Returns the matched target names (the `x` in `from "./x"`), de-duplicated in
// first-seen order — a barrel commonly re-exports one file from two statements
// (a value export and a `export type` export), and each file must be scanned
// only once.
//
// The pattern is non-greedy and semicolon-bounded so it matches EACH re-export
// separately — including multi-line `export type { ... } from "./x"` blocks —
// without a greedy match collapsing the whole barrel into one. Only local
// `./x` targets are captured; bare specifiers (e.g. `from "@sukko/sdk"`) are
// excluded (they reference external packages, not local files).
function discoverReExports(indexContent) {
  const reExportRegex = /export\s+[^;]*?\s+from\s+['"]\.\/([^'"]+)['"]/g;
  const targets = [];
  const seen = new Set();
  let match;
  while ((match = reExportRegex.exec(indexContent)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      targets.push(match[1]);
    }
  }
  return targets;
}

// Extract all exported symbols for one package: the barrel's own exports plus
// those of every local file it re-exports. A re-export whose target file does
// not resolve is skipped with a stderr log (stdout is reserved for the JSON).
function extractPackage(pkgSrcDir) {
  const indexFile = path.join(pkgSrcDir, 'index.ts');
  if (!fs.existsSync(indexFile)) {
    return [];
  }

  const content = fs.readFileSync(indexFile, 'utf-8');
  const allExports = extractExports(indexFile);

  for (const target of discoverReExports(content)) {
    const refFile = path.join(pkgSrcDir, target + '.ts');
    if (fs.existsSync(refFile)) {
      allExports.push(...extractExports(refFile));
    } else {
      console.error(`skip: cannot resolve re-export ./${target} (${refFile})`);
    }
  }

  return allExports;
}

function main() {
  const sdkRoot = process.argv[2];
  if (!sdkRoot) {
    console.error('Usage: node index.js /path/to/sukko-js');
    process.exit(1);
  }

  const output = { packages: [] };

  for (const pkg of packages) {
    const pkgSrcDir = path.join(sdkRoot, pkg.dir, 'src');
    output.packages.push({
      name: pkg.name,
      dir: pkg.dir,
      exports: extractPackage(pkgSrcDir),
    });
  }

  console.log(JSON.stringify(output, null, 2));
}

module.exports = { extractExports, discoverReExports, extractPackage };

if (require.main === module) {
  main();
}
