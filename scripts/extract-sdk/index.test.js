const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Importing must NOT run main() — verifies the require.main === module guard.
const { discoverReExports, extractPackage } = require('./index.js');

const fixtureSrc = path.join(__dirname, 'testdata', 'pkg', 'src');

test('discoverReExports finds all local targets, excludes bare specifiers, de-dups', () => {
  const indexContent = fs.readFileSync(path.join(fixtureSrc, 'index.ts'), 'utf-8');
  // Exact list guards three regressions at once: a greedy-regex collapse (which
  // would drop all but the last), inclusion of the bare `@external` specifier,
  // and duplication of `./a` (re-exported from two statements — must appear once).
  assert.deepStrictEqual(discoverReExports(indexContent), ['a', 'b', 'c', 'missing']);
});

test('extractPackage captures multi-line, single-line, and wildcard re-exports', () => {
  const names = extractPackage(fixtureSrc).map((e) => e.name);
  // multi-line `export type { B, C } from "./b"` — the case the fix restores
  assert.ok(names.includes('B'), 'B (multi-line) present');
  assert.ok(names.includes('C'), 'C (multi-line) present');
  // single-line `export { A } from "./a"` — no regression
  assert.ok(names.includes('A'), 'A (single-line) present');
  // `export * from "./c"` — no regression
  assert.ok(names.includes('D'), 'D (wildcard) present');
});

test('a file re-exported from multiple statements is scanned only once', () => {
  const exports = extractPackage(fixtureSrc);
  const aCount = exports.filter((e) => e.name === 'A').length;
  assert.strictEqual(aCount, 1, 'A must appear once — ./a is scanned once despite two re-export statements');
  assert.ok(exports.some((e) => e.name === 'AKind'), 'AKind (from the second ./a statement) is present');
});

test('unresolvable re-export target is skipped without throwing', () => {
  // ./missing does not resolve; extractPackage logs to stderr and continues.
  assert.doesNotThrow(() => extractPackage(fixtureSrc));
});
