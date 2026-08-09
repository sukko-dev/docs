# Sukko Docs

Developer documentation for **Sukko** — a multi-tenant WebSocket infrastructure platform. Built with [Docusaurus 3](https://docusaurus.io/) (TypeScript + MDX) and published at **[docs.sukko.dev](https://docs.sukko.dev)**.

## Prerequisites

- **Node.js ≥ 20** and **npm**

## Local development

```bash
npm install
npm start
```

`npm start` launches a hot-reloading dev server at **http://localhost:3000**. Editing MDX under `docs/` reflects live.

Other commands:

```bash
npm run build      # Production build to build/
npm run serve      # Serve the production build locally
npm run clear      # Clear the Docusaurus cache
npm run typecheck  # tsc
```

## Content

Authored content lives in `docs/` as MDX. Some reference pages are **generated at build time** — they are gitignored and rebuilt on every `start`/`build`, so **do not hand-edit generated output**.

See [`CLAUDE.md`](./CLAUDE.md) for content conventions (required frontmatter, edition badges, copy-pasteable examples, guide structure) and full local setup. When adding, removing, or renaming a page, also update `static/llms.txt`.

## Deploy

The site is built and deployed automatically by CI on merge to `main`. `npm run build` produces the static site in `build/`.
