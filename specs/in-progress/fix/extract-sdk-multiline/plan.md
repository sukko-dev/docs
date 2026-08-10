# Implementation Plan: Extractor captures multi-line SDK re-exports

**Branch**: `fix/extract-sdk-multiline` | **Date**: 2026-08-10 | **Spec**: specs/backlog/fix/extract-sdk-multiline/spec.md

## Summary

Fix the SDK-reference extractor (`scripts/extract-sdk/index.js`) so its re-export discovery matches multi-line `export type { … } from "./x"` blocks, not just single-line ones — restoring `./transport` and `./types` (SukkoClientOptions, SukkoClientEvents, DataMessage, ConnectionState, Transport, TransportState, message/protocol types) to the generated SDK reference. Use a non-greedy, semicolon-bounded pattern (to avoid a greedy-`dotAll` collapse), send the graceful-skip log to stderr (stdout is the JSON artifact), refactor the script to be unit-testable, add a `node:test` suite + fixture (sukko-docs has no JS test harness today), and correct the stale "TypeDoc"/`plugins/` documentation in the script header and `CLAUDE.md`.

## Technical Context

**Language**: JavaScript (Node ≥20, CommonJS — `require`/`module.exports`)
**Component**: `scripts/extract-sdk/index.js` (build-time reference extractor)
**Pipeline**: `extract.sh` → `node extract-sdk/index.js $SUKKO_JS > generated/sdk-reference.json` → `generate-docs.js` → `docs/reference/sdk/*.mdx`
**Test runner**: none today → adopt built-in `node:test` (no new dependency)
**Build/Deploy**: `npm run build` (extract+generate+docusaurus) on push/PR; Cloudflare Pages deploy currently `if: false`
**Repo conventions**: `CLAUDE.md` (no formal numbered constitution)

## Constitution / Conventions Check (`CLAUDE.md`)

| Rule | Status |
|---|---|
| Reference pages are auto-generated; don't hand-edit generated output | ✅ Fix is in the *generator*, not the generated MDX; `generated/` stays gitignored |
| `generated/*.json` not committed | ✅ Unchanged; only the extractor + a `testdata/` fixture are added |
| `testdata/` fixture doesn't break existing dev commands | ✅ Added to `tsconfig.json` `exclude` so `npm run typecheck` stays green (fixture has intentional unresolvable modules) |
| Test enforced, not just present | ✅ `npm test` wired into `deploy.yml` build job |
| Content guidelines (copy-pasteable, etc.) | n/a (no docs *content* change) |
| Commit format (conventional) | ✅ `fix:` |
| CLAUDE.md accuracy | ✅ This fix corrects CLAUDE.md's stale `plugins/` claim (FR-005) |

No violations. sukko-docs-only; no cross-repo impact (sukko-js unchanged; the SDK page regenerates from it).

## Phase 1 — Design

### Data flow (unchanged; discovery step widened)

```
sukko-js packages/*/src/index.ts  (barrel: single- AND multi-line re-exports)
        │  extract-sdk/index.js — reExportRegex discovers ./x targets  ← FIX HERE
        ▼
generated/sdk-reference.json  (stdout)   ── stderr: skip logs (FR-004)
        │  generate-docs.js (seen-Set dedup, no whitelist)
        ▼
docs/reference/sdk/core.mdx  (+ per-package pages)
```

### Affected files

| File | Change |
|---|---|
| `scripts/extract-sdk/index.js` | (1) `reExportRegex` → `/export\s+[^;]*?\s+from\s+['"]\.\/([^'"]+)['"]/g`; (2) factor discovery into `discoverReExports(indexContent)` returning matched local target names **de-duplicated in first-seen order** (a file re-exported from two statements is scanned once), with a `console.error` (stderr) skip log for a `./x` whose `<x>.ts` doesn't resolve; (3) extract per-package logic into `extractPackage(pkgSrcDir)` (uses `discoverReExports`); (4) `module.exports = { extractExports, discoverReExports, extractPackage }` + wrap bottom call in `if (require.main === module) main()`; (5) fix the header comment (drop the "TypeDoc" claim). |
| `scripts/extract-sdk/index.test.js` | New — `node:test` suite: `discoverReExports` returns `['a','b','c','missing']` (SC-007 guard); `extractPackage` output has multi-line (`B`,`C`) + single-line (`A`) + `export *` (`D`) symbols; `./missing` skipped without throw. |
| `scripts/extract-sdk/testdata/pkg/src/{index.ts,a.ts,b.ts,c.ts}` | New fixture — single-line, multi-line `export type`, `export *`, bare-specifier (excluded), unresolvable (`./missing`). |
| `tsconfig.json` | Add `scripts/extract-sdk/testdata` to `exclude` (fixture has intentionally-unresolvable modules that would fail `npm run typecheck`, since tsconfig globs `scripts/**`). |
| `package.json` | Add `"test": "node --test 'scripts/extract-sdk/**/*.test.js'"`; bump `engines.node` `>=20` → `>=22` (the `--test` positional-glob needs Node ≥21; match CI's Node 22). |
| `.github/workflows/deploy.yml` | Add a `- run: npm test` step to the build job (before `npm run build`) so the greedy-guard is enforced in CI. |
| `CLAUDE.md` | Fix the two `plugins/` references (Reference-Pages prose + Project-Structure) → attribute rendering to `scripts/generate-docs.js`. |

No change to `generate-docs.js`, `extract.sh`, the barrel, or any `sukko-js` file. Repo is **CommonJS** (no `package.json` `"type"`) — `require`/`module.exports`/`require.main` are correct.

### Key change (regex) and skip path

- Current: `/export\s+.*\s+from\s+['"]\.\/([^'"]+)['"]/g` (single-line only).
- New: `/export\s+[^;]*?\s+from\s+['"]\.\/([^'"]+)['"]/g` — lazy, `;`-bounded, crosses newlines; captures **all** local re-exports (multi- and single-line); bare specifiers excluded by the `\.\/` anchor.
- Skip: `if (fs.existsSync(refFile)) { push } else { console.error(\`skip: cannot resolve re-export ./${name}\`) }` — stderr, non-fatal.

### Configuration

None (no env vars). Adds one `package.json` script.

## Verification

1. **Unit tests** — `npm test` (`node --test 'scripts/extract-sdk/**/*.test.js'`) → green: `discoverReExports` returns `['a','b','c','missing']` (SC-007 greedy guard — bare `@external` excluded), multi-line types captured (`B`,`C`), single-line (`A`) + `export *` (`D`) still captured (no regression), `./missing` skipped without crash.
1b. **Typecheck** (SC-008) — `npm run typecheck` → green (confirms `testdata/` is excluded from tsconfig; `npx tsc --showConfig` shows the fixture absent from `files`).
2. **Real-source smoke** (SC-001) — `node scripts/extract-sdk/index.js ../sukko-js | grep -E "SukkoClientOptions|SukkoClientEvents|DataMessage|ConnectionState|Transport|TransportState"` → all present; and single-line ones (`SukkoClient`, `buildChannel`) still present (SC-002). Capture the command's own exit/stdout to a file (avoid grep-pipe status traps).
3. **Build** (SC-005) — with `../sukko-js`, `../sukko-cli`, `../sukko` present: `npm run build` completes; `docs/reference/sdk/core.mdx` now shows the previously-missing types.
4. **Doc accuracy** (SC-004/SC-006) — extractor header no longer says "TypeDoc"; `CLAUDE.md` no longer references `plugins/`.
5. **JSON integrity** (FR-004) — force a bad `./x` in the fixture and confirm the skip log lands on **stderr** and stdout remains valid JSON (`node … | jq . >/dev/null`).

## Risk

- **Low–medium.** The greedy-collapse pitfall is the main risk; mitigated by the mandated non-greedy pattern **and** the exact-list (deep-equals) assertion (SC-007) that fails if a collapse occurs. Refactor is mechanical (export seam + guard). Introducing `node:test` adds no dependency. `generated/` stays gitignored; only the generator + a fixture are added.

## Next

`/generate-tasks`
