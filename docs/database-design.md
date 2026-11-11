# Database Design

Full schema: `prisma/schema.prisma`. This doc explains the structure and
the rules that aren't obvious from the schema file alone.

## Ownership & tenancy

Every client-owned record traces back to an `Organization` via a direct
`organizationId` foreign key (or transitively through `Project`/`Invoice`).
`OrganizationMember` is the only bridge between a `User` and an
`Organization` — a `CLIENT` user's access to anything is always mediated
through this table and checked by `requireOrgPermission`
(`apps/api/src/plugins/rbac.ts`), never inferred from a record's shape.

`STAFF` users are not scoped to an organization at all; their access comes
from `User.staffRole` (global) via `requireStaffPermission`.

## Deletion rules

- `onDelete: Cascade` is used for strictly-owned child records (an
  `Organization`'s `OrganizationMember`s, a `Quote`'s `QuoteItem`s, a
  `Project`'s `Milestone`s, etc.) — deleting the parent is expected to take
  its children with it.
- Financial records (`Payment`, `Invoice`, `Refund`, `PaymentWebhookEvent`)
  deliberately do **not** cascade from anything and are never hard-deleted
  by application code — they're the audit trail. If an invoice needs to be
  cancelled, set `status = VOID`, don't delete the row.
- `AuditLog` has no delete path in the API at all.

## Indexing strategy

Every foreign key used in a `WHERE` clause by the API has a matching
`@@index` (e.g. `Invoice.organizationId`, `Payment.status`,
`AuditLog.entityType, entityId`). Unique constraints double as the
idempotency mechanism in two places that matter most:

- `PaymentWebhookEvent.(provider, providerEventId)` — a webhook can never
  be processed twice.
- `Payment.providerOrderId` / `Payment.providerPaymentId` — a gateway order
  or payment can only ever map to one row.

## Decimal handling

All money columns are `Decimal(12, 2)` in Postgres (via Prisma's
`Decimal` type), never `Float` — floating-point arithmetic on money is a
well-known source of off-by-a-paisa bugs. Application-level math (totals,
schedule validation) goes through `packages/shared/src/finance/money.ts`,
which is unit tested.

## Enums vs. free-text

Status fields (`InvoiceStatus`, `PaymentStatus`, `QuoteStatus`,
`ProjectStatus`, etc.) are Postgres enums via Prisma, not strings — invalid
states are rejected at the database level, not just by application code.

## Entities intentionally left "thin" for now

`Conversation`/`Message`, `File`/`FileVersion`, `SupportTicket`,
`Notification`/`DeviceToken` are fully modeled (so nothing has to be
re-migrated later) but their route handlers are not implemented yet — see
`PROGRESS.md`. The schema was designed for the complete P1–P5 scope up
front specifically so later phases are additive migrations, not schema
rewrites.

## Running migrations

```bash
pnpm install
cp .env.example apps/api/.env   # fill in DATABASE_URL at minimum
pnpm db:migrate                 # creates the Postgres schema
pnpm db:seed                    # seeds the real service categories + a sandbox admin
pnpm db:studio                  # optional: browse the data
```

A local PostgreSQL 16 instance is required (`DATABASE_URL` in
`.env.example` assumes `postgresql://postgres:postgres@localhost:5432/kryptonix_client`).
