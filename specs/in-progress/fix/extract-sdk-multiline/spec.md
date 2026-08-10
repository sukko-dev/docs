# Feature Specification: Extractor captures multi-line SDK re-exports

**Branch**: `fix/extract-sdk-multiline`
**Created**: 2026-08-10
**Status**: Draft
**Passes**: clarify 1, analyze 2, code-review 1

## Context

The published SDK reference at `docs.sukko.dev` is generated at build time: `scripts/extract-sdk/index.js` reads the `@sukko/sdk` barrel (`packages/sdk/src/index.ts`), discovers the files it re-exports, scans each for exported types/functions/classes, and emits `generated/sdk-reference.json`; `scripts/generate-docs.js` then renders that into `docs/reference/sdk/core.mdx` (and the per-package pages).

The extractor's re-export discovery only matches **single-line** re-exports. Its pattern (`reExportRegex`) matches `export … from './x'` where everything between `export` and `from` is on one line — a multi-line `export type { … }` block spanning several lines is not matched, so the file it points to is never scanned.

The sukko-js barrel has two such **multi-line** blocks:
- `export type { … } from "./transport"` — `Transport`, `TransportState`
- `export type { … } from "./types"` — `SukkoClientOptions`, `SukkoClientEvents`, `DataMessage`, `ConnectionState`, and the message/protocol types

Both are silently skipped. As a result, the most important SDK types are **absent** from the generated reference — a developer reading the SDK reference sees `SukkoClient`, the channel helpers, and constants, but not the options object they must pass, the events they can listen to, or the message shape they receive. Single-line re-exports (`./client`, `./emitter`, `./constants`, `./utils`) are captured correctly.

Note on reach: fixing extraction regenerates the build output (`docs/reference/sdk/core.mdx`) on every `npm run build`, but the live `docs.sukko.dev` is only updated once the Cloudflare Pages deploy step in `.github/workflows/deploy.yml` is enabled (it is currently gated `if: false` pending deploy secrets). Enabling that deploy is separate work (see Out of Scope).

A secondary defect: the file header comment claims the script "Parses exported types, functions, and classes using TypeDoc's JSON output" — it does not; it uses hand-rolled regex. The stale comment misleads anyone maintaining the extractor.

This is a `sukko-docs`-only fix to the extractor's discovery step.

## User Scenarios

### Scenario 1 - Published SDK reference is complete (Priority: P1)

A developer reading the SDK reference on `docs.sukko.dev` finds every publicly re-exported type, including those declared in multi-line `export type { … }` blocks.

**Acceptance Criteria**:
1. **Given** the sukko-js barrel re-exports `./transport` and `./types` via multi-line blocks, **When** the extractor runs, **Then** the generated reference includes the exports from both files (e.g. `SukkoClientOptions`, `SukkoClientEvents`, `DataMessage`, `Transport`, `TransportState`, `ConnectionState`).
2. **Given** the previously-captured single-line re-exports (`SukkoClient`, `buildChannel`/`parseChannel`, `CLOSE_CODES`, etc.), **When** the extractor runs after the fix, **Then** they are still present (no regression).

### Scenario 2 - Extractor documentation is accurate (Priority: P3)

A maintainer reading `scripts/extract-sdk/index.js` understands how it actually works.

**Acceptance Criteria**:
1. **Given** the file header comment, **When** a maintainer reads it, **Then** it accurately describes the regex-based extraction (no false "TypeDoc" claim).

### Edge Cases

- A re-export written on a single line (`export { X } from "./y";`) — MUST still be discovered (no regression).
- A re-export with a `type` modifier (`export type { … } from "./y"`) — MUST be discovered whether single- or multi-line.
- A default/`export *` re-export (`export * from "./y"`) — MUST be discovered.
- A relative import that is not a re-export — scanning its target for exports is harmless (extra exports at worst), but the discovery SHOULD target re-export statements to avoid pulling in unrelated files.
- A re-export to a **bare specifier** (e.g. the framework barrels' `export type { … } from "@sukko/sdk"`) — is **excluded at the regex level** (the pattern captures only `./x` targets), so it is never a scan candidate. Correct: it references an external package, not a local file.
- A matched **local** `./x` re-export whose `<x>.ts` file does not exist/resolve — MUST be skipped gracefully (stderr log, no crash).

## Requirements

### Functional Requirements

- **FR-001**: The extractor MUST discover files re-exported from the SDK barrel regardless of whether the re-export statement spans one line or multiple lines. The discovery pattern MUST be **non-greedy and statement-bounded** so it matches each re-export separately — e.g. `/export\s+[^;]*?\s+from\s+['"]\.\/([^'"]+)['"]/g` (the `[^;]` character class already crosses newlines, and the `;` terminator bounds each statement). A naive `dotAll` (`/s`) fix with a **greedy** `.*` MUST NOT be used: it collapses the whole barrel into one match that captures only the last re-export and drops all the others. The extractor MUST discover **all** local re-exports in the barrel (verifiable by count), not just the last.
- **FR-002**: For each discovered re-exported source file, the extractor MUST scan it for exported types/functions/classes/consts (as it already does for single-line re-exports) and include them in the generated reference. A file re-exported from multiple statements (a value export + an `export type` export) MUST be scanned **once** — `discoverReExports` de-duplicates targets in first-seen order.
- **FR-003**: Previously-captured single-line re-exports MUST remain captured — no regression in coverage.
- **FR-004**: Discovery MUST fail gracefully — a matched **local** `./x` re-export whose `<x>.ts` file cannot be read/resolved MUST be skipped with a log line **written to stderr**, not stdout, and MUST NOT abort the extraction or the build. This is load-bearing: the extractor's **stdout is the JSON artifact** (`extract.sh` runs `node extract-sdk/index.js "$SUKKO_JS" > generated/sdk-reference.json`), so any log on stdout would corrupt the JSON and break `generate-docs.js`'s `JSON.parse`. (The discovery pattern captures only `./x` targets — bare-specifier re-exports like `from "@sukko/sdk"` are excluded at the regex level and never become scan candidates, correctly, since they reference an external package.)
- **FR-005**: The stale documentation MUST be corrected to describe the actual (regex-based) mechanism: (a) the `scripts/extract-sdk/index.js` header comment that falsely claims "TypeDoc's JSON output"; and (b) this repo's `CLAUDE.md`, which states reference pages are rendered by "Docusaurus plugins in `plugins/`" and lists a `plugins/` entry in Project Structure — there is no `plugins/` directory; rendering is done by `scripts/generate-docs.js`. Both MUST be updated to attribute rendering to `scripts/generate-docs.js`.
- **FR-006**: The extractor MUST be made unit-testable: `scripts/extract-sdk/index.js` MUST factor re-export discovery into a **standalone exported function** (e.g. `discoverReExports(indexContent)` returning the matched local target names), export it alongside `extractExports` and `extractPackage`, and guard its CLI entry with `if (require.main === module)` so importing it in a test does not execute `main()`/`process.exit`. Discovery MUST be its own function so the greedy-collapse guard (SC-007) can assert the matched-target set directly — `extractPackage`'s flat exports array cannot prove which targets were discovered (a skipped `./missing` contributes zero symbols, and symbol count is fixture-coincidental).
- **FR-007**: The committed fixture MUST NOT break `npm run typecheck`. The root `tsconfig.json` has no `include` and globs `scripts/**`, so the fixture's intentionally-unresolvable modules (`./missing`, `@external`) would raise `TS2307`. `scripts/extract-sdk/testdata` MUST be added to `tsconfig.json`'s `exclude`.
- **FR-008**: The `node:test` suite MUST be executed in CI — a `npm test` step MUST be added to the build job in `.github/workflows/deploy.yml` (which already has Node 22 + `npm ci`; `node:test` needs no source repos). Otherwise the greedy-collapse guard runs only on developer machines and a regression ships undetected. Because the `node --test '<glob>'` positional-glob feature requires Node ≥21, `engines.node` MUST be bumped from `>=20` to `>=22` (matching the CI-tested version) so the declared floor is coherent with the test script.

> **Mechanism (resolved, formerly a clarification on FR-005):** use the targeted regex fix of FR-001 (multi-line-aware, non-greedy, statement-bounded) — NOT a TypeScript-compiler-API rewrite (that remains a noted future improvement, out of scope). The target files (`transport.ts`, `types.ts`) declare all needed symbols directly, so single-level scanning suffices — no compiler-grade transitive resolution is needed.

### Non-Functional Requirements

- **NFR-001**: The fix MUST be covered by a test, runnable **without network, without the full docs build, and without the `../sukko-js` sibling checkout**. Since sukko-docs currently has **no JS test harness** (no `test` script, no jest/vitest — only Go tests exist), the fix MUST: (a) adopt Node's built-in `node:test` (Node ≥20, already the engine floor — no new dependency); (b) wire a `"test"` script in `package.json` (e.g. `node --test 'scripts/extract-sdk/**/*.test.js'`); (c) commit a small **synthetic fixture barrel** under `scripts/extract-sdk/testdata/` reproducing a single-line re-export (`export { A } from "./a"`), a multi-line `export type { … } from "./b"` block, an `export * from "./c"`, a **bare specifier** (`from "@external"`, must be excluded), and an **unresolvable** local target (`from "./missing"`). (A default re-export needs no separate element — it is the same `export { … } from` discovery path as the named single-line case.) The test MUST assert: multi-line types are captured; single-line + `export *` symbols still are (no regression); the **`discoverReExports` result lists exactly the matched local targets** `['a','b','c','missing']` (guards the greedy-collapse pitfall of FR-001, SC-007); and the unresolvable target is skipped without crashing (stderr log, no throw).
- **NFR-002**: The extractor MUST remain resilient to a missing source repo / unreadable file (existing behavior) — no new hard failure paths.

### Key Entities

- **SDK barrel** (`packages/sdk/src/index.ts` in sukko-js): the entry file whose re-export statements enumerate the SDK's public surface.
- **Re-exported source file** (e.g. `./types`, `./transport`): a file named by a re-export that the extractor must scan for exported symbols.
- **SDK reference output** (`generated/sdk-reference.json` → `docs/reference/sdk/core.mdx`): the generated artifact that must reflect the full re-exported surface.

## Success Criteria

- **SC-001**: Running the SDK extractor against the sukko-js source produces output that includes `SukkoClientOptions`, `SukkoClientEvents`, `DataMessage`, `ConnectionState` (from `./types`) and `Transport`, `TransportState` (from `./transport`).
- **SC-002**: The same output still includes the single-line re-exports (`SukkoClient`, `buildChannel`, `parseChannel`, `CLOSE_CODES`, …) — no regression.
- **SC-003**: A `node:test` suite (run via the new `npm test`) passes locally against the committed fixture — without network and without a `../sukko-js` checkout — asserting multi-line + single-line + `export *` capture, the `discoverReExports` matched-target list (greedy-collapse guard), and graceful skip of an unresolvable target. It is also executed in CI (SC-009).
- **SC-004**: `scripts/extract-sdk/index.js` no longer claims to use TypeDoc.
- **SC-005**: The docs build (`extract` + `generate`) completes without error, and the regenerated `docs/reference/sdk/core.mdx` shows the previously-missing types. (This is the build artifact; live-site visibility additionally requires enabling the deploy step — see Out of Scope.)
- **SC-006**: `CLAUDE.md` no longer references a nonexistent `plugins/` directory; reference rendering is attributed to `scripts/generate-docs.js`.
- **SC-007**: `discoverReExports` returns all local barrel re-exports (for the fixture, exactly `['a','b','c','missing']`), not just the last — guarding against a greedy-regex collapse; asserted directly in the test.
- **SC-008**: `npm run typecheck` stays green — the `testdata/` fixture is excluded from `tsconfig.json`.
- **SC-009**: `.github/workflows/deploy.yml` runs `npm test` in its build job.

## Out of Scope

- Rewriting the extractor to use the TypeScript compiler API or real TypeDoc (a larger, separate effort — noted as a future improvement).
- Any change to `sukko-js` (its barrel already re-exports these types; the defect is purely in the extractor's discovery).
- The sukko platform residue (stale `proxy.go` comment, dead `ParseInternalChannel`, `topic.go` vestigial `category` naming) — separate spec.
- Changing what `generate-docs.js` renders or the layout of the reference pages (only the completeness of the extracted data changes).
- **Enabling the Cloudflare Pages deploy** step in `.github/workflows/deploy.yml` (currently `if: false` pending deploy secrets). Until that is enabled, this fix updates only the regenerated build artifact, not the live `docs.sukko.dev` — separate work.
- ~~Extractor-level de-duplication~~ **(now fixed during code review)**: the barrel re-exports `./emitter`/`./utils` across two statements each; `discoverReExports` now de-duplicates target files (first-seen order) so each is scanned once — no duplicate entries in the extractor JSON. (Previously masked downstream by `generate-docs.js`'s `seen` Set; now correct at source.)
