# Implementation Plan: Security Documentation

**Branch**: docs/security-guide | **Date**: 2026-04-07 | **Spec**: specs/backlog/docs/security-guide/spec.md

## Summary

Create a top-level "Security" page in the docs site that builds operator confidence in Sukko's security posture. The page is narrative-driven (not a config reference), opens with a "Security at a Glance" summary table, covers 7 security domains, and links out to existing concepts/reference pages for technical depth.

## Technical Context

**Framework**: Docusaurus 3 (TypeScript, MDX)
**Content**: MDX pages in `docs/`
**Components**: `EditionBadge` for edition-gated features
**Sidebar**: Configured in `sidebars.ts`
**Cross-links**: authentication, multi-tenancy, gateway, channels, configuration reference, roadmap, edition comparison

## Constitution Check

| Principle | Status |
|-----------|--------|
| Copy-pasteable code examples | N/A — narrative page, no code blocks |
| Prerequisites + Next Steps | OK — Next Steps section at bottom |
| EditionBadge for gated features | OK — used for Pro/Enterprise features |
| Frontmatter (title, description, sidebar_position) | OK |
| Conventional commits | OK |

No violations.

## Design

### Page Structure

```
docs/security.mdx          # New top-level page
```

**Sidebar placement** — insert `'security'` after `'quickstart'` in `sidebars.ts`:
```
quickstart
security        ← NEW
Concepts/
Guides/
Reference/
Editions/
roadmap
```

### Content Outline

```markdown
---
title: Security
description: How Sukko secures multi-tenant WebSocket infrastructure at every layer
---

import EditionBadge from '@site/src/components/EditionBadge';

# Security

[Opening paragraph — Sukko is built with security as a core design principle, not an afterthought. Every connection, channel, and message is protected by multiple layers of defense.]

## Security at a Glance

| Layer | Protection |
|-------|------------|
| **Connection** | JWT authentication (ES256, RS256, EdDSA), API key identification, per-IP and global rate limiting |
| **Channel** | Tenant-scoped namespacing, public/user-scoped/group-scoped access patterns |
| **Topic** | Tenant-prefixed Kafka topics, isolated consumer groups |
| **Data** | Tenant-scoped database queries, AES-256-GCM credential encryption |
| **Transport** | TLS for all backend connections (Kafka, NATS, Valkey) |

## Authentication
[Narrative: Every connection is authenticated. Sukko validates JWTs with industry-standard algorithms...]
- ES256 (default, recommended), RS256, EdDSA
- Claims-based identity: tenant_id, sub, roles, groups
- Key registration via provisioning API, supports rotation and revocation
- Link → [Authentication concepts](./concepts/authentication)

## Authorization
[Narrative: Channel access is enforced at the gateway before any message reaches the server...]
- Public channels: accessible via API key (no JWT needed)
- User-scoped channels: require `sub` claim match
- Group-scoped channels: require `groups` claim membership
- Per-tenant channel rules <EditionBadge edition="pro" />
- Link → [Channels](./concepts/channels)

## Tenant Isolation
[Narrative: Every tenant is isolated at every layer of the stack...]
- Connections: tenant extracted from JWT, all operations scoped
- Channels: internally namespaced as {tenant_id}.{suffix}
- Topics: Kafka topics prefixed with tenant_id
- Data: all database queries scoped to tenant
- Cross-tenant requests rejected at the gateway
- Link → [Multi-Tenancy](./concepts/multi-tenancy)

## Key Management
[Narrative: Sukko never stores private keys. Only public keys are registered...]
- Per-tenant key registry with kid-based lookup
- Keys validated for algorithm match, expiration, revocation
- In-memory cache with automatic background refresh
- Admin keys with separate issuer validation and stricter lifetime controls
- Link → [Authentication concepts](./concepts/authentication), [REST API](./reference/rest-api)

## Rate Limiting & Abuse Protection
[Narrative: Sukko protects against abuse at multiple levels...]
- Per-client message rate limiting (token bucket)
- Per-IP connection rate limiting
- Global connection rate limiting
- Publish rate and message size limits
- Per-tenant connection limits <EditionBadge edition="pro" />
- Link → [Gateway](./concepts/gateway)

## Transport Security
[Narrative: All backend connections support TLS encryption...]
- Kafka/Redpanda: TLS + SASL authentication
- NATS: TLS with CA certificate verification
- Valkey: TLS with CA certificate verification
- Link → [Configuration Reference](./reference/configuration)

## Secrets Handling
[Narrative: Sensitive credentials are encrypted at rest using AES-256-GCM...]
- All secrets via environment variables (never in config files)
- Credential encryption with AES-256-GCM (authenticated encryption)
- Secrets excluded from logs and debug output
- Link → [Configuration Reference](./reference/configuration)

## Planned Security Enhancements
[Coming soon features with edition badges and roadmap links]
- Audit Logging <EditionBadge edition="enterprise" />
- Per-Tenant IP Allowlisting <EditionBadge edition="enterprise" />
- End-to-End Encryption <EditionBadge edition="enterprise" />
- Token Revocation <EditionBadge edition="pro" />
- Link → [Roadmap](./roadmap)

## Next Steps
- [Quickstart](./quickstart) — Try Sukko in 5 minutes
- [Authentication](./concepts/authentication) — Deep dive into JWT auth
- [Configuration Reference](./reference/configuration) — All security-related env vars
- [Edition Comparison](./editions/comparison) — See which security features are in each edition
```

### Files to Modify/Create

| Action | File | Description |
|--------|------|-------------|
| **Create** | `docs/security.mdx` | Security narrative page (no `sidebar_position` — ordering controlled by `sidebars.ts`) |
| **Modify** | `sidebars.ts` | Add `'security'` after `'quickstart'` |
| **Modify** | `static/llms.txt` | Add Security page entry for AI agent discoverability |

> **Note:** This is a top-level overview page, not a guide. The CLAUDE.md "prerequisites + next steps" convention applies to guides. This page includes Next Steps but omits prerequisites by design — there are none.

### Cross-Link Targets (existing pages, read-only)

| Section | Links to |
|---------|----------|
| Authentication | `docs/concepts/authentication.mdx` |
| Authorization | `docs/concepts/channels.mdx` |
| Tenant Isolation | `docs/concepts/multi-tenancy.mdx` |
| Key Management | `docs/concepts/authentication.mdx`, `docs/reference/rest-api.mdx` |
| Rate Limiting | `docs/concepts/gateway.mdx` |
| Transport Security | `docs/reference/configuration.mdx` |
| Secrets Handling | `docs/reference/configuration.mdx` |
| Planned Enhancements | `docs/roadmap.mdx` |
| Next Steps | quickstart, authentication, configuration, comparison |

## Verification

1. `npm start` — verify Security page loads at `/docs/security`
2. Verify sidebar shows "Security" as top-level item after Quickstart
3. Verify all internal links resolve (no broken links)
4. Verify EditionBadge renders for Pro/Enterprise features
5. Verify "Security at a Glance" table renders correctly
6. `npm run build` — verify production build succeeds
