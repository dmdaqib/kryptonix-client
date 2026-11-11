# Progress Report

Read this first. It's the honest, current state of the project — what
runs, what's written-but-unverified, and what's not started.

## Environment this was built in (read this before judging "why wasn't X run")

This repo was built inside a sandboxed agent environment with **no access
to the npm registry or any package-installation network** (confirmed: `npm
install`, `pnpm install`, and `gh repo create` via the API all failed with
`ENOTFOUND`/auth errors; `gh` CLI had no working credential for repo
creation). A local PostgreSQL 16 was available and used for one round of
hands-on verification during schema design, but no JavaScript dependency
(Fastify, Prisma CLI, Expo, Razorpay SDK, zod, etc.) could be installed or
executed. Two globally pre-installed tools were available and used:
Node 22 (with its native TypeScript type-stripping and built-in test
runner) and `psql`.

**What this means concretely:**
- Code that depends only on Node's built-in modules was **actually written
  and actually executed** in this environment, with real passing test
  output (see below).
- Everything that depends on an npm package (the entire Fastify API, the
  entire Expo app, Prisma Client) is **carefully written but has not been
  run or type-checked in this environment**. It needs `pnpm install` on a
  machine with normal network access (your machine, or GitHub Actions —
  `.github/workflows/ci.yml` does exactly this) before it's verified.
- Do not treat anything below marked "written, not executed here" as
  equivalent to tested code. Treat it as a strong first draft that needs
  `pnpm install && pnpm typecheck && pnpm test` as the next step.

## P1 — Foundation: ✅ written, 🟡 partially verified

**Features implemented:**
- Monorepo scaffold (pnpm workspaces, shared TS config)
- Full Prisma schema covering all 24 spec sections' worth of entities (not
  just P1) — see `docs/database-design.md`
- Auth: register, email verification, login, refresh-token rotation with
  reuse detection, logout, forgot/reset password, rate limiting, account
  lockout
- Organizations: creation on registration, staff approval queue
- Invitations: create/list/revoke/accept, single-use, expiring, audited
- RBAC: full `ClientRole`/`StaffRole` → `Permission` matrix, enforced on
  every route via `requireOrgPermission`/`requireStaffPermission`
- Audit logging for every sensitive action listed above

**Screens completed (mobile):** Splash/router, Welcome, Login, Register,
Verify Email (holding screen), Forgot Password, Reset Password, Pending
Approval, Accept Invitation. Design system (colors, typography, Button,
TextField, Card, EmptyState, ScreenContainer) built around the site's only
published brand signal, `#7C3AED`.

**API endpoints implemented:** see `docs/api-contracts.md` — Auth,
Organizations, Invitations sections (12 endpoints).

**Database changes:** initial schema, no migration history yet generated
(requires `prisma migrate dev`, which requires `pnpm install` — see above).

**Tests executed and actual results:**
```
packages/shared — 20/20 passing (Node's native test runner, no deps needed)
  ✓ password.test.ts     5 tests — scrypt hash/verify, rejects short/malformed
  ✓ jwt.test.ts           5 tests — sign/verify, wrong secret, expiry, tampering
  ✓ rbac.test.ts          5 tests — client & staff permission matrix
  ✓ money.test.ts         5 tests — invoice totals, paise conversion, schedule validation
  ✓ razorpay-signatures   5 tests — checkout & webhook HMAC verification, tamper detection
```
These are the actual, currently-passing results from this sandbox (run via
`node --experimental-strip-types --test src/**/*.test.ts`), not a
projection. They cover the security/money-critical pure-logic pieces by
design — the pieces where a silent bug would be worst.

The Fastify API routes, Prisma queries, and Expo screens are **written but
not executed** here (no way to install Fastify/Prisma Client/Expo in this
sandbox). They're straightforward, conventional usage of each library, but
"straightforward" is not "tested" — run `pnpm install && pnpm db:migrate &&
pnpm dev:api` and exercise the endpoints (or let CI do it) before trusting
them in front of a real client.

As a partial substitute, every `.ts`/`.tsx` file in the repo (both
`apps/api` and `apps/mobile`) was run through `tsc --noEmit` with the
globally-available TypeScript compiler, filtering out the errors that are
expected with no `node_modules` present (unresolved packages, missing
`@types/node`). Result: **zero parse/syntax errors (TS1xxx) anywhere in
the codebase.** This doesn't substitute for real type-checking against
installed dependencies — it only proves every file is syntactically valid
TypeScript/JSX, which is still worth knowing before you run `pnpm install`
for the first time.

**Known limitations:**
- Login lockout counter is in-process memory, not shared across instances
- No row-level security at the Postgres level yet (app-layer only)
- Real KryptonIX logo asset not yet dropped into `apps/mobile/assets/`
  (site only exposes it via a Next.js image proxy URL, not a direct
  downloadable asset this environment could fetch)
- No brand font published by the site; using Inter as a placeholder

## P2 — Service Purchase: ✅ written, not executed

Catalogue (categories/services/packages/features — public read, staff
write), enquiries (client submit, staff assign), quotes (create with line
items, send, client view/accept/reject/request-revision with acceptance
evidence). Seeded with KryptonIX's real service lines from the website
(custom software, salon/gym software, websites & booking, SEO, paid ads,
automation/AI) — no invented categories or prices.

**Not implemented:** Agreements module (schema exists; no routes/screens).
Package availability-window logic (schema exists, unused). Mobile screens
for the quote accept/reject/revision flow (API exists; screen not built).

## P3 — Project Collaboration: 📋 schema only

`Project`, `Milestone`, `ProjectTask`, `Conversation`/`Message`, `File`,
`Deliverable`/`Approval` are fully modeled in the database with the
relationships and indexes the spec calls for. **No route handlers or
mobile screens exist yet** — the mobile Projects tab calls the (not yet
implemented) `/organizations/:id/projects` endpoint so no further UI
rework is needed once it ships, but it will currently 404.

## P4 — Financial System: ✅ written, not executed — prioritized per your explicit scope

This got the most attention because you were explicit that payments (Flow
A: clients paying KryptonIX — invoices, instalments, retainers) is the
core requirement. Fully written: provider-independent payment interface,
Razorpay adapter, invoice creation with configurable instalment schedules,
the complete "never trust the client, verify everything, idempotent
webhooks" payment flow, refund request/approve/reject, receipts. Full
sequence diagram in `docs/PAYMENTS.md`. The signature-verification and
money-math logic is the part that's actually unit-tested (see P1 results
above) — it's the part where correctness matters most and was achievable
to verify without installing anything.

**Not implemented:** automatic recurring debits via UPI AutoPay/card
mandate (schema reserves `autoDebitMandateId`; spec itself says this needs
real provider configuration, not something to fake). Receipt PDF
generation (a `Receipt` row is created; rendering it as a downloadable PDF
is not built).

## P5 — Team & Support: 📋 schema only

`SupportTicket`/`TicketMessage`, `Notification`/`DeviceToken`/
`NotificationPreference`, and the full staff-role schema exist. Staff
screens beyond organization approval, support ticket routes/screens, and
the push/email notification dispatcher are not built.

## P6 — Production: not started

No security audit, load testing, or store submission has been (or could
be) performed. See the checklist in `docs/deployment.md`.

## Remaining work, roughly in priority order

1. Run `pnpm install` somewhere with network access (your machine or CI)
   and fix whatever the first real `pnpm typecheck` turns up — treat this
   as expected, not a sign anything is wrong; it's the first time these
   files meet a real TypeScript compiler.
2. Generate the first Prisma migration against a real Postgres instance
   and confirm the schema actually applies cleanly.
3. Get real Razorpay test-mode keys and walk the full payment sequence by
   hand (create invoice → pay → confirm → trigger a test webhook from the
   Razorpay dashboard) before writing integration tests against it.
4. Drop in the real KryptonIX logo + brand font once available.
5. Build out P3 (projects/messaging/documents/approvals) — the schema and
   API contract are ready for it.
6. Build out P5 (support tickets, notifications, staff screens).
7. Everything in the P6 checklist (`docs/deployment.md`).

## Next phase

Once this is pushed and you've run `pnpm install` + CI passes, the next
concrete unit of work is **P3: Projects & Milestones** — it's what makes
the "Pending Approval → Active Project" flow after a quote is accepted
actually show something in the app, and it's a prerequisite for messaging
and deliverable approvals.
