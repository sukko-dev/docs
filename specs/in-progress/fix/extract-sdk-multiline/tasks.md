# Tasks: Extractor captures multi-line SDK re-exports

**Branch**: `fix/extract-sdk-multiline` | **Spec**: spec.md | **Plan**: plan.md

Phases adapted for a Node build-script fix: Code → Fixture → Test → Docs → Verify → Review.

## Phase 1: Code (extractor)

- [x] **T001** In `scripts/extract-sdk/index.js`, change `reExportRegex` to `/export\s+[^;]*?\s+from\s+['"]\.\/([^'"]+)['"]/g` (non-greedy, `;`-bounded; matches multi- AND single-line; bare specifiers excluded by the `\.\/` anchor). Do NOT use a greedy `dotAll`.
- [x] **T002** Add a graceful-skip stderr log: on the re-export loop's `fs.existsSync(refFile)` check, add an `else { console.error(\`skip: cannot resolve re-export ./${reMatch[1]}\`); }`. MUST be `console.error` (stderr) — stdout is the JSON artifact.
- [x] **T003** Refactor for testability: factor re-export discovery into `function discoverReExports(indexContent)` that returns the matched local target names (array, using the T001 regex); extract the per-package logic (index scan + discovery + per-target file scan, including the T002 stderr skip) into `function extractPackage(pkgSrcDir)` returning the exports array (using `discoverReExports`); have `main()` call `extractPackage`. Add `module.exports = { extractExports, discoverReExports, extractPackage };` and wrap the bottom `main();` in `if (require.main === module) { main(); }`.
- [x] **T004** Rewrite the stale file-header comment block: remove **both** TypeDoc references — the false `Parses … using TypeDoc's JSON output` claim (line 3) **and** the `A full TypeDoc integration can replace this later` note (line 8) — and describe the actual regex-based extraction. If noting the future improvement, phrase it as a "TypeScript compiler API" extractor (not "TypeDoc") so `grep -i TypeDoc` returns empty (satisfies T012/SC-004).

## Phase 2: Fixture (depends on T003)

- [x] **T005** Create a synthetic fixture under `scripts/extract-sdk/testdata/pkg/src/`:
  - `index.ts` — a single-line `export { A } from "./a";`, a multi-line `export type {\n  B,\n  C,\n} from "./b";`, an `export * from "./c";`, a bare-specifier `export type { X } from "@external";` (must be ignored), and an unresolvable `export { Z } from "./missing";` (must be skipped).
  - `a.ts` (`export const A = 1` or `export function A(){}`), `b.ts` (`export type B = string; export interface C {}`), `c.ts` (`export class D {}`) — so discovered files yield known symbols.

## Phase 3: Test (depends on T003/T005)

- [x] **T006** Add `scripts/extract-sdk/index.test.js` using `node:test` + `node:assert`. Import via `require('./index.js')` (must not run `main()` — verifies T003's guard). Assert:
  - `discoverReExports(<fixture index.ts content>)` deep-equals `['a','b','c','missing']` (all local targets matched, `@external` excluded) — the greedy-collapse guard (SC-007);
  - `extractPackage('<testdata>/pkg/src')` output contains multi-line types `B`, `C` (the core fix), single-line `A`, and the `export *` target's `D` (no regression);
  - `./missing` is skipped without throwing (stderr log allowed).
- [x] **T007** Add `"test": "node --test 'scripts/extract-sdk/**/*.test.js'"` to `package.json` scripts.
- [x] **T007a** Add `scripts/extract-sdk/testdata` to `tsconfig.json`'s `exclude` array (the fixture's intentional unresolvable modules would otherwise fail `npm run typecheck`, since tsconfig globs `scripts/**` with no `include`). Verify with `npx tsc --showConfig` (fixture absent from `files`).
- [x] **T007b** Add a `- run: npm test` step to the build job in `.github/workflows/deploy.yml`, before `npm run build` (Node 22 + `npm ci` already present; `node:test` needs no source repos). Enforces the greedy-guard in CI (SC-009).

## Phase 4: Docs (CLAUDE.md) — [P] with Phase 3

- [x] **T008** [P] In `CLAUDE.md`, fix the two stale `plugins/` references: the "Reference Pages (Auto-Generated)" prose ("Docusaurus plugins in `plugins/` render…") and the `plugins/` line in Project Structure → attribute rendering to `scripts/generate-docs.js`.

## Phase 5: Verify (depends on Phase 1–4; run in order)

- [x] **T009** Unit tests: `npm test` → green (all T006 assertions). Capture exit code directly.
- [x] **T009a** Typecheck (SC-008): `npm run typecheck` → green — confirms the `testdata/` fixture is excluded from tsconfig (would otherwise emit TS2307 on `./missing`/`@external`).
- [x] **T010** [P] Real-source smoke (SC-001/SC-002), if `../sukko-js` present: `node scripts/extract-sdk/index.js ../sukko-js > /tmp/sdkref.json 2>/tmp/sdkref.err`; assert `/tmp/sdkref.json` is valid JSON (`jq . >/dev/null`) and contains `SukkoClientOptions`, `SukkoClientEvents`, `DataMessage`, `ConnectionState`, `Transport`, `TransportState` AND still `SukkoClient`, `buildChannel`. (Skip if sibling repo absent — note it.)
- [x] **T011** [P] JSON integrity (FR-004): confirm the fixture's `./missing` skip log went to **stderr** (`/tmp/sdkref.err` or the test), and stdout stayed valid JSON.
- [x] **T012** [P] Doc accuracy: grep confirms `extract-sdk/index.js` no longer says "TypeDoc" and `CLAUDE.md` no longer references `plugins/`.

## Phase 6: Review

- [ ] **T013** Present the full diff for review (no-auto-commit). After approval: commit (conventional `fix:`, identity klurvio/red@klurv.io, no AI attribution) and open a PR to sukko-docs `main`. The spec dir is tracked in sukko-docs — include it in the commit.

## Dependencies

- T001–T004 (code) → T005 (fixture) → T006 (test) → T007. T008 `[P]`. Phase 5 after all code+docs; T009 first, then T010–T012 `[P]`. T013 last.

## Notes

- The greedy-collapse is the key risk — T006's exact-list (deep-equals) assertion (`['a','b','c','missing']`) is the guard; do not weaken it to a `.length` check.
- Do not touch `generate-docs.js`, `extract.sh`, the barrel, or sukko-js.
- Full docs build (SC-005) needs all sibling repos + Go; the `npm test` + real-source smoke are the primary gates here.
