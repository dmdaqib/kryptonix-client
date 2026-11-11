# Payments & Billing

This is the module the spec calls "one of the most important parts of the
application," and the one this build prioritized completing end-to-end.

## Principles (non-negotiable)

1. **The server decides the amount, never the client.** `POST
   /invoices/:id/pay` computes the amount from the invoice/schedule row in
   the database. The request body cannot set an amount.
2. **The checkout response is not proof of payment.** When the mobile app
   reports a successful Razorpay Checkout, the backend verifies the
   checkout signature (proves the payment belongs to *our* order) but only
   moves the payment to `PENDING` — never `SUCCEEDED`, never updates the
   invoice.
3. **Only a verified webhook marks an invoice paid.** `POST
   /webhooks/razorpay` verifies the webhook signature over the *raw* request
   body, and only `payment.captured` moves money: increments
   `invoice.amountPaid`, flips status to `PARTIALLY_PAID` or `PAID`, marks
   the instalment (if any) `PAID`, and issues a `Receipt`.
4. **Every webhook is idempotent.** `PaymentWebhookEvent` has a unique
   `(provider, providerEventId)` constraint. A retried or replayed webhook
   is detected and short-circuited before any state change.
5. **No card data ever touches this stack.** Razorpay Checkout (native SDK
   in the app) collects card/UPI/netbanking/wallet details directly inside
   Razorpay's own UI. Neither the app nor the API ever sees a PAN or CVV.

## Sequence

```
1. Client taps "Pay" on an invoice (or one instalment of it)
2. POST /api/v1/invoices/:id/pay
     → server loads the invoice, computes the amount, calls
       RazorpayProvider.createOrder()
     → creates a Payment row (status=CREATED) keyed by providerOrderId
     → returns { paymentId, providerOrderId, amount, currency, keyId }
3. Mobile app opens RazorpayCheckout.open({ order_id, amount, key: keyId })
     → Razorpay's native UI handles the actual charge
4. POST /api/v1/payments/:id/confirm
     → verifies checkout signature (HMAC-SHA256 of orderId|paymentId,
       keyed with RAZORPAY_KEY_SECRET)
     → records the attempt, sets payment status PENDING (invoice untouched)
5. Razorpay → POST /api/v1/webhooks/razorpay   (server-to-server, async)
     → verifies webhook signature (HMAC-SHA256 of the raw body, keyed with
       RAZORPAY_WEBHOOK_SECRET)
     → deduplicates by (provider, providerEventId)
     → on payment.captured: Payment→SUCCEEDED, Invoice.amountPaid+=amount,
       Invoice.status recomputed, Receipt created
     → on payment.failed: Payment→FAILED
```

## Refunds

`POST /payments/:id/refunds` (client, `invoices.refund.request`) creates a
`Refund` row in `REQUESTED`. `POST /refunds/:id/review` (staff Finance
Manager, `invoices.refund.approve`) either rejects it or calls
`RazorpayProvider.createRefund()` and moves it to `PROCESSING`; the
`refund.processed` webhook is what finally sets `COMPLETED` — again, never
the synchronous API response.

## Instalments & recurring billing

`PaymentSchedule` rows represent a configurable instalment plan
(advance/milestone/final, or any custom split) attached to one `Invoice`.
`computeInvoiceTotals` + `validateScheduleSumsToTotal`
(`packages/shared/src/finance/money.ts`) guarantee a schedule always sums
exactly to the invoice total — the API rejects a mismatched schedule at
creation time.

`RecurringInvoiceConfiguration` models a recurring charge (interval,
amount, next run date). **What's built:** the schema and the manual
"generate the next invoice, client pays it like any other invoice" path.
**What's intentionally not built yet:** automatic recurring debits via a
UPI AutoPay / card mandate — the spec is explicit that this requires actual
customer mandate authorization and provider-side configuration that can't
be faked in a sandbox; `autoDebitMandateId` is reserved on the schema for
when that's wired up against a real Razorpay account.

## App Store payment policy

The services KryptonIX sells through this invoicing flow (custom software,
SEO, ads management, salon/gym software licensing) are real-world business
services delivered outside the app, which both Apple and Google permit
billing through an external payment processor like Razorpay — no in-app
purchase requirement. If a future feature sells digital content *consumed
inside the app itself*, re-check Apple's guideline 3.1 before reusing this
same checkout flow for it.

## Environment variables

```
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=            # test-mode key during development
RAZORPAY_KEY_SECRET=        # never ships in mobile code — server-only
RAZORPAY_WEBHOOK_SECRET=    # set when configuring the webhook in the Razorpay dashboard
```

Get test-mode keys from the Razorpay Dashboard → Settings → API Keys
(toggle to Test Mode first). Point the dashboard's webhook URL at
`{API_BASE_URL}/api/v1/webhooks/razorpay` and select at minimum
`payment.captured`, `payment.failed`, `refund.processed`.
