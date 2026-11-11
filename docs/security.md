# Security

## Authentication

- Passwords hashed with **scrypt** (Node's built-in `crypto`, N=16384,
  r=8, p=1, 16-byte random salt per hash). No bcrypt/argon2 dependency —
  see `docs/architecture.md` for why that trade-off was made here.
- Access tokens are short-lived (15 min) HS256 JWTs signed with
  `JWT_ACCESS_SECRET`. They carry `sub` (user id), `sid` (session id) and
  `role`. On every request, the session is re-checked in the database
  (`plugins/auth.ts`) — **revoking a session invalidates its access tokens
  immediately**, it does not wait for them to expire.
- Refresh tokens are opaque random 256-bit strings, stored **hashed**
  (SHA-256) in `RefreshToken`, 30-day expiry. Every refresh **rotates** the
  token: the old one is marked `replacedById`, a new one is issued. If an
  already-rotated token is ever presented again, the entire session is
  revoked — this is the standard defense against a stolen refresh token
  being used after the legitimate client has already rotated past it.
- Login is rate-limited both per-route (`@fastify/rate-limit`, 5/15min on
  `/login`) and with an in-process lockout after 5 failed attempts for the
  same email (15 min). **Known limitation:** the lockout counter is
  in-memory (`Map`), so it resets on restart and doesn't share state across
  multiple API instances — move it to Redis before running more than one
  instance.
- Password reset and email verification tokens: same pattern as refresh
  tokens (random, stored hashed, single-use, time-limited). Password reset
  additionally revokes every active session for that user.
- `/auth/forgot-password` always returns the same response whether or not
  the email exists, so it can't be used to enumerate registered accounts.

## Authorization

**The backend is the only enforcement point.** `requireOrgPermission` and
`requireStaffPermission` (`plugins/rbac.ts`) are called explicitly at the
top of every route that touches organization- or staff-scoped data; nothing
is inferred from what a mobile screen merely shows. The permission matrix
itself (`packages/shared/src/rbac.ts`) is unit-tested (see
`packages/shared/src/rbac.test.ts`).

Two layers exist on purpose:
- **Coarse, hardcoded matrix** (`ClientRole`/`StaffRole` → `Permission[]`)
  — what ships today, what's tested, what every route actually calls.
- **`Role`/`Permission`/`RolePermission` tables** in the schema — reserved
  for a future admin UI that lets KryptonIX customize permissions per
  deployment without a code change. Not wired up yet; the hardcoded matrix
  is authoritative until it is.

## E-signature

`QuoteAcceptance` and `AgreementAcceptance` record identity, timestamp, IP,
user agent and the exact version accepted. **This is acceptance evidence,
not a compliant e-signature.** Do not represent an in-app "Accept" button
to clients or in marketing as a legally binding signature until a
dedicated e-signature provider (e.g. DocuSign, Aadhaar eSign, or
equivalent) is integrated and reviewed with counsel — the spec is explicit
on this point and the schema/API deliberately stop short of claiming more
than they verify.

## Payments

Covered in full in `docs/PAYMENTS.md`. Summary of the security-relevant
points: amounts are server-computed, checkout responses are signature
verified but don't move money, only a signature-verified idempotent
webhook does, and card data never reaches this stack.

## File access

`File.storageKey` is never exposed directly. The spec and schema assume
short-lived signed URLs (`SIGNED_URL_TTL_SECONDS`, default 300s) from
whichever object storage provider is configured (`STORAGE_PROVIDER`).
**Not yet implemented**: the actual upload/download route handlers and the
S3 (or equivalent) signed-URL generator — tracked in `PROGRESS.md` under
P3. Do not serve files from a public bucket URL when that lands.

## Secrets

- `.env` is git-ignored; `.env.example` ships with empty values only.
- `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` live only in the
  API's environment — never in mobile app code or config.
- The mobile app only ever receives `RAZORPAY_KEY_ID` (public by design)
  at payment-order time, never the secret.

## Audit logging

`AuditLog` is written explicitly at the points the spec calls out:
registration, organization approval, invitation lifecycle, quote
send/accept/reject/revision, invoice creation, refund request/review. It
is append-only — nothing updates or deletes an `AuditLog` row.

## Known gaps before production

- [ ] Move login-lockout counters to Redis (or equivalent shared store)
- [ ] Implement signed-URL file upload/download
- [ ] Add a real e-signature provider if quote/agreement acceptance needs
      to be legally binding
- [ ] Add database row-level security policies (schema supports it; not
      yet written) as a second line of defense behind application-layer checks
- [ ] Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` generation into a
      secrets manager rather than plain env vars for production
- [ ] Add Sentry (or equivalent) — `SENTRY_DSN` is reserved in
      `.env.example` but not wired up
