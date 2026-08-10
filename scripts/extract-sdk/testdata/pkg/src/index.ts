// Fixture barrel for scripts/extract-sdk/index.test.js — exercises the
// re-export discovery forms. Not shipped; excluded from tsconfig.

// single-line named re-export
export { A } from "./a";

// second statement re-exporting the SAME file (value + type split) — the
// extractor must scan ./a only once (de-dup), not twice
export type { AKind } from "./a";

// multi-line type re-export (the case the fix restores)
export type {
	B,
	C,
} from "./b";

// wildcard re-export
export * from "./c";

// bare specifier — MUST be excluded from discovery (external package)
export type { X } from "@external";

// local target that does not resolve — MUST be skipped gracefully
export { Z } from "./missing";
