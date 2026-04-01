#!/usr/bin/env node

// Extract SDK reference from sukko-js TypeScript packages.
// Parses exported types, functions, and classes using TypeDoc's JSON output.
//
// Usage: node index.js /path/to/sukko-js
//
// For v1, this produces a simplified reference by parsing the package index files
// directly. A full TypeDoc integration can replace this later.

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

function main() {
  const sdkRoot = process.argv[2];
  if (!sdkRoot) {
    console.error('Usage: node index.js /path/to/sukko-js');
    process.exit(1);
  }

  const output = { packages: [] };

  for (const pkg of packages) {
    const pkgDir = path.join(sdkRoot, pkg.dir, 'src');
    const indexFile = path.join(pkgDir, 'index.ts');

    let allExports = [];

    if (fs.existsSync(indexFile)) {
      allExports = extractExports(indexFile);

      // Also scan re-exported files referenced in index
      const content = fs.readFileSync(indexFile, 'utf-8');
      const reExportRegex = /export\s+.*\s+from\s+['"]\.\/([^'"]+)['"]/g;
      let reMatch;
      while ((reMatch = reExportRegex.exec(content)) !== null) {
        const refFile = path.join(pkgDir, reMatch[1] + '.ts');
        if (fs.existsSync(refFile)) {
          allExports.push(...extractExports(refFile));
        }
      }
    }

    output.packages.push({
      name: pkg.name,
      dir: pkg.dir,
      exports: allExports,
    });
  }

  console.log(JSON.stringify(output, null, 2));
}

main();
