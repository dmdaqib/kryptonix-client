# Architecture

## Overview

KryptonIX Client is a monorepo with three workspaces:

```
apps/mobile   React Native (Expo, TypeScript, Expo Router) — the product
apps/api      Fastify + TypeScript + Prisma REST API
packages/shared  Code shared by both: zod DTOs, RBAC matrix, money math,
                  password/JWT/token crypto, Razorpay signature verification
```

The mobile app never talks to Postgres, Razorpay, or any other backing
service directly — everything goes through the API over HTTPS. Business
logic (RBAC checks, payment state transitions, invoice totals) lives in
`packages/shared` or `apps/api/src`, never duplicated in mobile UI code.

## Request flow

```
Mobile app
  │  Bearer <accessToken>  (JWT, 15 min)
  ▼
Fastify (apps/api)
  │  preHandler: resolveAuthUser → looks up Session, attaches request.authUser
  │  route handler: requireOrgPermission / requireStaffPermission (RBAC)
  │  service layer: Prisma queries, business rules
  ▼
PostgreSQL (via Prisma)
```

Refresh is a separate, longer-lived opaque token (not a JWT) stored hashed
in `RefreshToken`, with rotation on every use (see `docs/security.md`).

## Why these specific choices

- **Fastify over Express**: first-class TypeScript types, built-in schema
  validation hooks, meaningfully faster under load — matters once payment
  webhooks and polling dashboards are both hitting the same instance.
- **Prisma over a raw query builder**: the schema in `prisma/schema.prisma`
  is the single source of truth for both migrations and generated types;
  cuts out an entire class of "the DB and the code disagree" bugs.
- **Expo Router over bare React Navigation**: file-based routing keeps the
  36+ screens the spec calls for organized by URL-shaped folders instead of
  one large navigator config, and ships typed routes.
- **A dependency-free crypto layer in `packages/shared/src/security`**:
  password hashing (scrypt), JWT (HS256) and token generation all use only
  Node's built-in `crypto` module. This was a deliberate choice for this
  project, not a general recommendation — see `docs/PROGRESS.md` for why:
  it let the security-critical code actually be written and unit-tested
  inside a sandboxed environment with no package-registry access, instead
  of being unverified code that merely *looked* right.

## Payment architecture

See `docs/PAYMENTS.md` for the full request/webhook sequence. The short
version: the mobile app never sets a payment amount, never sees the
Razorpay key secret, and the invoice is never marked paid by a client
response — only by a signature-verified, idempotent webhook.

## What's implemented vs. scaffolded

See `PROGRESS.md` for the authoritative, up-to-date breakdown. In short:
auth, organizations, invitations, RBAC, the service catalogue, enquiries,
quotes, and the full payments/invoicing/refunds module are implemented.
Projects/milestones, messaging, documents, deliverable approvals, support
tickets, and most staff-side screens are modeled in the database and
planned in the API contract but not yet wired up with route handlers or
mobile screens.
