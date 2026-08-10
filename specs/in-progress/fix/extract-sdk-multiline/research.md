# Phase 0 Research: Extractor captures multi-line SDK re-exports

**Branch**: `fix/extract-sdk-multiline` | **Date**: 2026-08-10

The clarify pass resolved the spec's `[NEEDS CLARIFICATION]` and surfaced the real hazards. This records the decisions and the ground truth (verified against `scripts/extract-sdk/index.js`, `scripts/generate-docs.js`, the sukko-js barrel, and `package.json` on `origin/main`).

## Decision 1 — Targeted regex fix, non-greedy + semicolon-bounded

- **Decision**: Change `reExportRegex` from `/export\s+.*\s+from\s+['"]\.\/([^'"]+)['"]/g` to `/export\s+[^;]*?\s+from\s+['"]\.\/([^'"]+)['"]/g`.
- **Why**: `[^;]` crosses newlines (so multi-line `export type { … } from "./x"` blocks match) while the `;` terminator bounds each statement, and `*?` is lazy — together preventing the **catastrophic greedy-`dotAll` collapse** (a greedy `/…/gs` would match from the first `export` to the last `from "./utils"`, capturing only `./utils` and dropping every other re-export). Verified: all barrel re-exports end in `;` and re-export specifier lists contain only commas (no `;`), so `[^;]*?` is safe.
- **Alternatives rejected**: greedy `dotAll` (collapses the barrel — worse than the bug); TS-compiler-API rewrite (out of scope; unnecessary — target files declare symbols directly, no transitive resolution needed).

## Decision 2 — The `./`-anchor already excludes external specifiers (FR-004 correction)

- **Ground truth**: the capture is `['"]\.\/([^'"]+)['"]` — it requires a `"./"` prefix. Bare specifiers (`from "@sukko/sdk"` in the react/vue/svelte barrels) **do not match** and are never scan candidates. This is correct — those reference the external package, already documented on its own page.
- **Correction**: an earlier clarify finding claimed the multi-line fix would make bare-specifier blocks "hit the skip path." That is false — the `./`-anchor filters them at match time. The graceful-skip path (FR-004) applies only to a matched `./x` whose `<x>.ts` doesn't resolve.
- **FR-004 remains required** for a different, real reason: the extractor's **stdout is the JSON artifact** (`extract.sh` … `> generated/sdk-reference.json`), so the skip log MUST go to **stderr** or it corrupts the JSON and breaks `generate-docs.js`'s `JSON.parse`. The current code skips silently (no log); FR-004 adds a stderr log.

## Decision 3 — Refactor for testability (export seam + require.main guard)

- **Decision**: `index.js` currently defines `extractExports`/`main` with no exports and calls `main()` unconditionally (which reads `process.argv[2]` and `process.exit(1)` if absent). Refactor to: extract the per-package logic (index scan + re-export discovery) into a testable function (e.g. `extractPackage(pkgSrcDir)`); `module.exports = { extractExports, extractPackage }`; wrap the CLI entry in `if (require.main === module) main()`.
- **Why**: NFR-001 needs the discovery logic callable from a test without spawning the CLI or triggering `process.exit`.

## Decision 4 — Test harness: `node:test` + committed fixture (no new dep, hermetic)

- **Decision**: Adopt Node's built-in `node:test` (Node ≥20 is the engine floor — zero new dependency), add a `"test": "node --test 'scripts/extract-sdk/**/*.test.js'"` script to `package.json`, and commit a synthetic fixture under `scripts/extract-sdk/testdata/`.
- **Impl note**: the script MUST use the `**/*.test.js` glob, NOT the directory form `node --test scripts/extract-sdk/`. The directory form also executes `index.js` itself, whose `main()` runs with no `argv[2]` → prints `Usage` and `process.exit(1)`, failing the run. The glob matches only the test file. (Verified during implementation.)
- **Fixture shape**: a fake package `testdata/pkg/src/` with an `index.ts` containing: a single-line `export { A } from "./a"`, a multi-line `export type { B, C } from "./b"`, an `export * from "./c"`, a bare-specifier `export type { X } from "@external"` (assert NOT scanned), and an unresolvable `export { Z } from "./missing"` (assert graceful stderr skip). Plus `a.ts`/`b.ts`/`c.ts` declaring those symbols.
- **Why**: hermetic (no `../sukko-js` checkout, no network), and it exercises the greedy-collapse guard (assert discovered-count) and all re-export forms — which the real barrel can't (it has no `export *`/default/unresolvable forms). SC-001 (real symbols) is validated separately at the docs build (SC-005).
- **Alternatives rejected**: vitest/jest (new dependency); testing against real `../sukko-js` (brittle, non-hermetic, can't cover edge forms).

## Decision 5 — No extractor-level dedup needed

- **Ground truth**: `generate-docs.js:234` builds a `seen` Set and renders only `unique` exports, collapsing the pre-existing `./emitter`/`./utils` double-scan. So duplicate JSON entries never reach `core.mdx`. Extractor-level dedup is unnecessary (out of scope, acknowledged in the spec).

## Decision 6 — Also fix the parallel stale doc in CLAUDE.md

- **Decision**: Beyond the extractor header comment (the false "TypeDoc" claim), correct `CLAUDE.md`'s two references to a nonexistent `plugins/` directory (Reference-Pages prose + Project-Structure list) — rendering is done by `scripts/generate-docs.js`. Same defect class; same repo; this is the claim that misled an agent earlier in the SDK review.

## Decision 7 — Reach: build artifact, not live site

- **Ground truth**: `.github/workflows/deploy.yml` runs `npm run build` (extract+generate) on push/PR but the Cloudflare Pages deploy step is `if: false` (pending secrets). So this fix regenerates `core.mdx` in the build; live `docs.sukko.dev` updates only once deploy is enabled — separate work (Out of Scope). `generate-docs.js` has no whitelist, so the newly-captured types render with no further change.
