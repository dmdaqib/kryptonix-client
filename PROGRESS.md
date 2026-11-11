# Progress Report

Read this first. It's the honest, current state of the project — what
runs, what's written-but-unverified, and what's not started.

**Update:** CI is green on `main` (`.github/workflows/ci.yml`, GitHub's
own runners, real network access). Everything below that was "written,
not executed here" has since actually run on a real Postgres service
container and a real `pnpm install` — typecheck, `packages/shared`'s
unit tests, and (as of the P3/P5 work) a real integration test suite for
`apps/api` all pass. The per-phase sections below are left as originally
written where still accurate, with corrections noted inline.

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

## P3 — Project Collaboration: ✅ implemented and integration-tested

`Project`, `Milestone`, `ProjectTask`, `Conversation`/`Message`, `File`,
`Deliverable`/`Approval` now have real route handlers
(`apps/api/src/modules/projects/{projects,messaging,files}.routes.ts`)
and real mobile screens:

- **Project detail** (`projects/[id].tsx`): status, milestones with their
  latest deliverable, client approve/request-changes actions, and
  (for staff) create-milestone / submit-deliverable actions, plus
  project updates.
- **Project chat** (`projects/[id]/messages.tsx`): one conversation per
  project (created lazily), staff-only internal notes hidden from the
  client, simple 5s polling (no websocket/realtime transport is wired
  up — see Known limitations).

Staff and client share the same screens, gated by `user.userType` —
there's no separate staff app; a staff user signed into this app sees
the create/submit/assign actions a client doesn't.

**Verified end-to-end** by `apps/api/src/test/projects-and-support.integration.test.ts`,
which runs the real Fastify server (`app.inject()`, real Postgres) through:
create project → add staff member → create milestone → register a file →
submit deliverable (milestone → `SUBMITTED_FOR_REVIEW`, client notified) →
client approves (milestone → `APPROVED`, staff notified) → both sides
exchange project messages → an outsider is correctly refused. This is a
stronger guarantee than typecheck alone — it's the actual route code
running against the actual schema.

**Not implemented:** real file upload/object storage (deliverables
register file *metadata* only — see `files.routes.ts`'s doc comment;
no S3/GCS provider is wired up, same constraint as payments' "no
outbound network" limitation). `ProjectTask` has routes
(`POST /projects/:id/tasks`, `PATCH /tasks/:id`) but no dedicated mobile
screen yet. Agreements module (schema exists; no routes/screens).

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

## P5 — Team & Support: ✅ implemented and integration-tested (dispatcher excepted)

`SupportTicket`/`TicketMessage` and `Notification`/`DeviceToken`/
`NotificationPreference` now have real route handlers
(`apps/api/src/modules/support/tickets.routes.ts`,
`apps/api/src/modules/notifications/notifications.routes.ts`,
`apps/api/src/plugins/notify.ts`) and real mobile screens:

- **Tickets** (`tickets/index.tsx`, `tickets/[id].tsx`, `tickets/new.tsx`):
  a client raises a ticket and replies in it; staff see the full queue
  across every organization, assign to themselves, reply, and
  resolve/close. Reached from Profile (no separate tab — see
  `projects/[id].tsx`'s note on sharing screens between client and staff).
- **Notifications** (`notifications/index.tsx`): list, unread indicator,
  mark-one / mark-all-read. Wired into the quote-sent, project-created,
  project-status-changed, deliverable-submitted/approved/revision-requested,
  project-message, ticket-created/replied/resolved flows via
  `plugins/notify.ts`'s `notifyUser`/`notifyOrganization`/`notifyProjectStaff`/`notifyStaffRole`
  helpers.

**Verified end-to-end** by the same integration test as P3: client raises
a ticket → it appears in the support staff's queue → staff assigns and
replies (ticket → `AWAITING_CLIENT`) → client replies (ticket →
`IN_PROGRESS`) → staff resolves (client notified) → client's unread count
reflects it → mark-all-read zeroes it.

**Not implemented:** the actual push/email dispatcher. Every notification
is reliably written to the `Notification` table (so nothing is silently
dropped and the in-app list is always correct) and `DeviceToken`/
`NotificationPreference` have working CRUD routes specifically so a
dispatcher is a single well-defined addition later — but there's no
outbound network to a push gateway or email/SMTP provider in this
sandbox to actually send one. Staff screens beyond tickets/projects
(e.g. a dedicated client-management console) are not built — staff use
the same client-facing screens with extra actions rather than a separate
admin surface; a dedicated ops dashboard was judged out of scope for a
client-facing mobile app and is noted here rather than silently skipped.

## P6 — Production: not started

No security audit, load testing, or store submission has been (or could
be) performed. See the checklist in `docs/deployment.md`.

## Remaining work, roughly in priority order

1. ~~Run `pnpm install` somewhere with network access and fix whatever
   `pnpm typecheck` turns up~~ — done, CI is green on `main`.
2. ~~Generate the first Prisma migration against a real Postgres
   instance~~ — done, `db:migrate:deploy` runs against CI's postgres
   service on every push.
3. Get real Razorpay test-mode keys and walk the full payment sequence by
   hand (create invoice → pay → confirm → trigger a test webhook from the
   Razorpay dashboard). Still not done — needs real credentials, which is
   explicitly a "your move" step (see the sandbox/test-defaults decision
   made at project start).
4. Drop in the real KryptonIX logo + brand font once available.
5. ~~Build out P3 (projects/messaging/documents/approvals)~~ — done, see
   the P3 section above, including real file metadata but not real
   object storage.
6. ~~Build out P5 (support tickets, notifications)~~ — done, see the P5
   section above, except the push/email dispatcher itself.
7. A real object-storage provider (S3/GCS) behind `files.routes.ts`, so
   deliverable uploads are real files, not just metadata rows.
8. A real push/email dispatcher reading `Notification`/`DeviceToken`/
   `NotificationPreference` (Expo push for mobile, Resend/SMTP for email
   — `config.ts` already has the env vars reserved for this).
9. Everything in the P6 checklist (`docs/deployment.md`): security audit,
   load testing, app store submission prep. Not started.

## Next phase

P1–P5 all have real route handlers, real mobile screens, and CI-verified
tests (unit tests for `packages/shared`'s pure logic, a real Postgres
integration test for `apps/api`'s routes). What's left to turn this into
something you could actually ship is infrastructure, not app logic:
real Razorpay credentials, real object storage, a real push/email
dispatcher, and the P6 production checklist — then running the Expo app
on a real device (`pnpm install`, `db:migrate`, `db:seed`, `dev:api`,
`dev:mobile` + Expo Go or an EAS dev build for the Razorpay-dependent
payment screen, per the walkthrough already given earlier in this
project's history).
