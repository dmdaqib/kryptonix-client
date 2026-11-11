# API Contracts

Base URL: `{API_BASE_URL}/api/v1`. All responses are JSON, shaped as
`{ data: ... }` or `{ message: ... }` on success and
`{ error: { code, message, details? } }` on failure. Authenticated routes
expect `Authorization: Bearer <accessToken>`.

Routes marked **✅ implemented** have working handlers + Prisma queries.
Routes marked **📋 planned** exist in the original spec and are modeled in
the database but have no route handler yet (see `PROGRESS.md`).

## Auth — `/auth` ✅

| Method & Path | Auth | Description |
|---|---|---|
| POST `/auth/register` | public | Create a CLIENT user + their Organization (PENDING_APPROVAL) |
| POST `/auth/verify-email` | public | Consume email verification token |
| POST `/auth/login` | public | Returns `{ user, accessToken, refreshToken }` |
| POST `/auth/refresh` | public (refresh token in body) | Rotates refresh token, returns new pair |
| POST `/auth/logout` | required | Revokes the current session |
| POST `/auth/forgot-password` | public | Always 200; emails a reset link if the account exists |
| POST `/auth/reset-password` | public | Consumes reset token, revokes all sessions |
| GET `/auth/me` | required | Current user + their organization memberships |

## Organizations ✅

| Method & Path | Auth | Description |
|---|---|---|
| GET `/organizations/pending` | staff: `staff.manage_clients` | Orgs awaiting approval |
| POST `/organizations/:id/approve` | staff: `staff.manage_clients` | Approves org + activates its OWNER |
| GET `/organizations/:id` | member or staff | Org detail, members, addresses |

## Invitations ✅

| Method & Path | Auth | Description |
|---|---|---|
| POST `/organizations/:id/invitations` | client: `org.manage_members` | Create + email an invitation |
| GET `/organizations/:id/invitations` | client: `org.manage_members` | List invitations |
| POST `/organizations/:id/invitations/:invitationId/revoke` | client: `org.manage_members` | Revoke a pending invitation |
| POST `/invitations/accept` | public (token in body) | Accept invitation, create/link user |

## Catalogue ✅

| Method & Path | Auth | Description |
|---|---|---|
| GET `/catalogue/categories` | public | Active service categories |
| GET `/catalogue/services` | public | Services, optional `?categoryId=` |
| GET `/catalogue/services/:slug` | public | Service detail + packages + features |
| POST `/catalogue/services` | staff: `staff.manage_catalogue` | Create a service |
| POST `/catalogue/services/:id/packages` | staff: `staff.manage_catalogue` | Create a package under a service |

## Sales: Enquiries & Quotes ✅

| Method & Path | Auth | Description |
|---|---|---|
| POST `/enquiries` | client: `org.view` | Submit a custom requirement |
| GET `/organizations/:organizationId/enquiries` | client: `org.view` | List org's enquiries |
| GET `/staff/enquiries` | staff: `quotes.create` | Sales queue, optional `?status=` |
| POST `/staff/enquiries/:id/assign` | staff | Assign an enquiry to a staff member |
| POST `/quotes` | staff: `quotes.create` | Create a draft quote with line items |
| POST `/quotes/:id/send` | staff: `quotes.send` | Move DRAFT/REVISION_REQUESTED → SENT |
| GET `/organizations/:organizationId/quotes` | client: `quotes.view` | List org's quotes |
| GET `/quotes/:id` | client or staff | Quote detail (marks VIEWED) |
| POST `/quotes/:id/accept` | client: `quotes.accept` | Records `QuoteAcceptance` evidence |
| POST `/quotes/:id/reject` | client: `quotes.accept` | → REJECTED |
| POST `/quotes/:id/request-revision` | client: `quotes.accept` | → REVISION_REQUESTED + snapshot |

## Finance: Invoices, Payments, Refunds ✅

| Method & Path | Auth | Description |
|---|---|---|
| POST `/invoices` | staff: `invoices.create` | Create invoice (+ optional instalment schedule) |
| GET `/organizations/:organizationId/invoices` | client: `invoices.view` | List org's invoices |
| GET `/invoices/:id` | client: `invoices.view` | Invoice detail incl. items, schedule, payments |
| POST `/invoices/:id/pay` | client: `invoices.pay` | Server computes amount, creates gateway order |
| POST `/payments/:id/confirm` | client: `invoices.pay` | Verifies checkout signature (does NOT mark paid) |
| GET `/organizations/:organizationId/payments` | client: `invoices.view` | Payment history |
| POST `/payments/:id/refunds` | client: `invoices.refund.request` | Request a refund |
| POST `/refunds/:id/review` | staff: `invoices.refund.approve` | Approve (→ gateway refund) or reject |
| GET `/organizations/:organizationId/refunds` | client: `invoices.view` | Refund history |
| POST `/webhooks/razorpay` | Razorpay signature | Server-to-server payment/refund confirmation |

## 📋 Planned (modeled in schema, not yet implemented)

| Area | Endpoints |
|---|---|
| Agreements | `/agreements`, `/agreements/:id/versions`, `/agreements/:id/accept` |
| Projects | `/organizations/:id/projects`, `/projects/:id`, milestone CRUD |
| Messaging | `/projects/:id/conversations`, `/conversations/:id/messages` (+ WebSocket) |
| Documents | `/files` upload/download (signed URLs), `/deliverables/:id/approve` |
| Support | `/support/tickets` CRUD, staff assignment/reply |
| Notifications | `/notifications`, `/device-tokens`, preference management |
| Staff admin | Full Super Admin / Admin screens beyond organization approval |

These are the routes a client (mobile app) should call once each phase
ships — kept here so the mobile team can build against a stable contract
even before the handler exists.
