# CLAUDE.md

## Project Overview

Sukko Docs is the developer documentation site for Sukko — a multi-tenant WebSocket infrastructure platform. Built with Docusaurus 3 (TypeScript, MDX), deployed to `docs.sukko.dev` via Cloudflare Pages.

## Development Commands

```bash
npm start          # Dev server (http://localhost:3000) with hot reload
npm run build      # Production build to build/
npm run serve      # Serve production build locally
npm run clear      # Clear Docusaurus cache
```

## Content Conventions

### MDX Pages

All content is in `docs/` as MDX files. Required frontmatter:

```mdx
---
title: Page Title
description: One-line description for SEO and search
sidebar_position: 1
---
```

For edition-gated content, add edition badges:
```mdx
import EditionBadge from '@site/src/components/EditionBadge';

## Feature Name <EditionBadge edition="pro" />
```

### Content Guidelines

- Every code example MUST be copy-pasteable — no pseudo-code
- Every guide MUST start with prerequisites and end with "Next Steps"
- Use language tabs for multi-language examples (cURL, TypeScript, Go)
- Edition-gated features MUST have `<EditionBadge>` badges

## Reference Pages (Auto-Generated)

Reference pages are generated from extracted JSON at build time:

```bash
# Config reference (from sukko platform repo)
cd scripts/extract-config && go run . /path/to/sukko

# CLI reference (from sukko-cli repo)
cd scripts/extract-cli && go run . /path/to/sukko-cli

# SDK reference (from sukko-js repo)
cd scripts/extract-sdk && node index.js /path/to/sukko-js
```

Output goes to `generated/` (gitignored). Docusaurus plugins in `plugins/` render the JSON into docs pages.

## Project Structure

```
docs/              # MDX content pages
src/
├── components/    # React components (EditionBadge, etc.)
├── pages/         # Custom pages (landing page)
└── css/           # Theme overrides
plugins/           # Docusaurus plugins for auto-generated reference pages
scripts/           # Go/Node extraction tools
static/            # Images, llms.txt, openapi.yaml
generated/         # Extracted JSON (gitignored, built at CI time)
```

## Commit Message Format

Conventional commits:
```
type: subject

Examples:
docs: add quickstart guide
feat: add config reference extraction script
fix: broken link in concepts section
style: update edition badge colors
```
