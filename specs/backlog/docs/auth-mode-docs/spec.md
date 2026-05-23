# Feature Specification: Document Auth Mode Enum

**Branch**: `docs/auth-mode-docs`
**Created**: 2026-04-09
**Status**: Draft
**Priority**: P2 — Medium
**Depends on**: `sukko:feat/public-read-auth-write`

## Context

Sukko's auth model is changing from a binary toggle (`AUTH_ENABLED=true/false`) to a string enum (`AUTH_ENABLED=required/disabled`, extensible to `public-read` in the future). The docs site needs to reflect this change and clearly document the API-key-only access model for public channel reads.

## Requirements

### Functional Requirements

- **FR-001**: Update the authentication concepts page (`concepts/authentication.mdx`) to document the auth mode enum (`required`/`disabled`) and the two credential tiers: API key (public read) vs JWT (full access).
- **FR-002**: Update the quickstart page (`quickstart.mdx`) to use the correct auth mode value (`disabled` instead of `false`) and fix channel format (tenant-prefixed: `sukko.general.chat` not `general.chat`).
- **FR-003**: Add a section documenting the API-key-only access model: how frontend apps embed an API key for public channel reads, what they can/can't do, how mid-connection JWT upgrade works.
- **FR-004**: Update the gateway concepts page (`concepts/gateway.mdx`) to describe the API-key-only permission model (public channels only, no publish).
- **FR-005**: Update the channels concepts page (`concepts/channels.mdx`) to clarify that public channels are accessible via API key without JWT, while private/group channels require JWT claims.
- **FR-006**: Update the configuration reference (`reference/configuration.mdx`) to document `AUTH_ENABLED` as a string enum with allowed values and descriptions.
- **FR-007**: Update SDK guides (`guides/sdk/*`) to show how to connect with API key only for public-read scenarios.

## Success Criteria

- **SC-001**: A developer reading the docs can understand the API key vs JWT access model without guessing.
- **SC-002**: All auth-related pages are consistent with the enum model.
- **SC-003**: Channel format is correct everywhere (`{tenant}.{suffix}`, not the old 3-part format).

## Out of Scope

- API reference updates (covered by OpenAPI/AsyncAPI spec changes in sukko repo)
- CLI documentation (covered by separate CLI spec)
- Future `public-read` anonymous mode documentation (when that ships)
