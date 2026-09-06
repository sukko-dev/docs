# Contributing

Content conventions for the Sukko documentation site (Docusaurus).

## Authoring

Authored pages live in `docs/` as MDX. Some reference pages are **generated at
build time** (configuration, CLI, SDK references) — they are gitignored and
rebuilt on every `start`/`build`. Never hand-edit generated output; fix the
source of truth in the platform repos instead.

## Frontmatter

Every page requires frontmatter:

```yaml
---
title: Page Title
description: One-sentence summary shown in search and social cards
sidebar_position: 1
---
```

## Edition badges

Pages or sections covering edition-gated features carry an `EditionBadge`:

```mdx
import EditionBadge from '@site/src/components/EditionBadge';

# Admin UI <EditionBadge edition="pro" />
```

The editions comparison page is generated from the platform's feature matrix —
badge individual guides, don't restate the matrix.

## Examples

Examples must be copy-pasteable: complete commands with realistic values, no
`<placeholders>` inside code blocks unless the surrounding text explains every
one. Prefer a runnable snippet over a fragment.

## Guide structure

Guides open with what the reader accomplishes and the time it takes
(`:::info Time to complete`), walk one happy path end to end, and defer
edge cases to a closing section or a reference page.

## Page index

When adding, removing, or renaming a page, also update `static/llms.txt` —
it is the discovery index for the documentation site.

## Local setup

See the [README](./README.md) for install, dev-server, build, and typecheck
commands.
