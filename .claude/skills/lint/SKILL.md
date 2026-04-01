---
name: lint
description: Auto-fix lint and formatting issues locally
user-invocable: true
---

# Lint

Auto-fix lint and formatting issues for the Docusaurus docs site.

## Usage

```
/lint [path...]
```

Examples:
- `/lint` - Fix the entire codebase
- `/lint src/components/` - Fix a directory
- `/lint docs/quickstart.mdx` - Fix a specific file

## Workflow

Run these in sequence:

1. `npx prettier --write .` — format all files (TypeScript, MDX, CSS, JSON)
2. `npx eslint --fix .` — auto-fix lint issues (if ESLint is configured)
3. `npm run build` — verify the site builds cleanly

Report summary:

```
## Lint Summary

- Prettier: formatted
- ESLint: X issues auto-fixed, Y remaining
- Build: pass/fail
- Remaining issues: [list any that need manual fixing]
```

## Notes

- Prettier is the primary formatter for this project (TypeScript, MDX, CSS)
- ESLint catches code quality issues in TypeScript/TSX files
- A clean `npm run build` is the ultimate validation — Docusaurus catches broken links, missing imports, and MDX errors at build time
