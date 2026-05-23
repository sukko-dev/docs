# Tasks: Security Documentation

**Branch**: docs/security-guide | **Date**: 2026-04-07

## Phase 1: Content

- [x] T001 Create `docs/security.mdx` — Write the full security narrative page with frontmatter (title: "Security", description: "How Sukko secures multi-tenant WebSocket infrastructure at every layer"). No sidebar_position — ordering is controlled by sidebars.ts. Import EditionBadge. Include opening paragraph positioning Sukko as secure-by-design. Add "Security at a Glance" summary table mapping 5 layers (Connection, Channel, Topic, Data, Transport) to their protection mechanisms. Write 7 narrative sections (Authentication, Authorization, Tenant Isolation, Key Management, Rate Limiting & Abuse Protection, Transport Security, Secrets Handling) — each leading with a confidence-building statement, followed by concise explanation, ending with a "Learn more" link to the relevant concepts/reference page. Add EditionBadge for per-tenant channel rules (Pro), per-tenant connection limits (Pro), audit logging (Enterprise), IP allowlisting (Enterprise), E2E encryption (Enterprise), token revocation (Pro). Include "Planned Security Enhancements" section linking to roadmap. End with "Next Steps" linking to quickstart, authentication, configuration reference, and edition comparison. Tone: trust-building narrative, no inline env var blocks or config details.

## Phase 2: Sidebar

- [x] T002 Modify `sidebars.ts` — Add `'security'` as the second item in the `docsSidebar` array, after `'quickstart'` and before the Concepts category. This makes Security a top-level sidebar item visible during evaluation.

## Phase 3: Discoverability

- [x] T003 Modify `static/llms.txt` — Add a Security entry in the Sections list after the Quickstart line: `- [Security](/security): How Sukko secures multi-tenant WebSocket infrastructure at every layer`.

## Phase 4: Verify

- [x] T004 Run `npm start` and verify: (1) Security page loads at `/docs/security`, (2) sidebar shows "Security" as top-level item after Quickstart, (3) "Security at a Glance" table renders correctly, (4) all EditionBadge components render, (5) all internal links to concepts/reference/roadmap pages resolve without errors.

- [x] T005 Run `npm run build` — verify production build succeeds with no broken link warnings.

## Dependencies

```
T001 → T002 (page must exist before sidebar reference)
T001 → T003 (page must exist before llms.txt reference)
T001, T002, T003 → T004 (verify after all created)
T004 → T005 (dev verify before production build)
```
