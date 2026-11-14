import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.ts";
import { prisma } from "../db/prisma.ts";
import { env } from "../config.ts";
import { createClientOrgOwner, type ClientOwner } from "./helpers.ts";

let app: FastifyInstance;
let client: ClientOwner;
let testInvoiceId: string;
let testPaymentId: string;
let providerOrderId: string;

function signWebhook(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

before(async () => {
  app = await buildServer();
  client = await createClientOrgOwner();

  // Create an invoice and payment record in DB
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: client.organizationId,
      invoiceNumber: `TEST-INV-${Date.now()}`,
      status: "SENT",
      subtotalAmount: 10000,
      taxAmount: 1800,
      totalAmount: 11800,
      currency: "INR",
      dueDate: new Date(Date.now() + 7 * 86400000),
    },
  });
  testInvoiceId = invoice.id;

  providerOrderId = `order_test_${Date.now()}`;
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      provider: "razorpay",
      providerOrderId,
      amount: 11800,
      currency: "INR",
      status: "CREATED",
    },
  });
  testPaymentId = payment.id;
});

after(async () => {
  await app.close();
});

test("webhook: reject webhook with missing or invalid signature", async () => {
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", order_id: providerOrderId, amount: 1180000 } } },
  });

  // Missing signature
  const resMissing = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/razorpay",
    headers: { "content-type": "application/json" },
    payload,
  });
  assert.equal(resMissing.statusCode, 400);

  // Invalid signature
  const resInvalid = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/razorpay",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": "bogus_signature_12345",
    },
    payload,
  });
  assert.equal(resInvalid.statusCode, 400);
});

test("webhook: valid payment.captured signature processes payment and issues receipt", async () => {
  const secret = env.RAZORPAY_WEBHOOK_SECRET || "rzp_test_webhook_placeholder";
  const paymentEntityId = `pay_wh_${Date.now()}`;
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentEntityId,
          order_id: providerOrderId,
          amount: 1180000, // 11,800 INR in paise
          method: "upi",
          status: "captured",
        },
      },
    },
  });

  const signature = signWebhook(payload, secret);

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/razorpay",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
    },
    payload,
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.received, true);

  // Verify database record updates
  const updatedInvoice = await prisma.invoice.findUnique({
    where: { id: testInvoiceId },
    include: { payments: { include: { receipt: true } } },
  });
  assert.ok(updatedInvoice);
  assert.equal(updatedInvoice.status, "PAID");
  assert.equal(Number(updatedInvoice.amountPaid), 11800);

  const updatedPayment = updatedInvoice.payments.find((p) => p.id === testPaymentId);
  assert.ok(updatedPayment);
  assert.equal(updatedPayment.status, "SUCCEEDED");
  assert.equal(updatedPayment.providerPaymentId, paymentEntityId);
  assert.ok(updatedPayment.receipt);
  assert.ok(updatedPayment.receipt.receiptNumber.startsWith("KX-RCPT-"));
});

test("webhook: idempotent deduplication when same event is received again", async () => {
  const secret = env.RAZORPAY_WEBHOOK_SECRET || "rzp_test_webhook_placeholder";
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_dup_${Date.now()}`,
          order_id: providerOrderId,
          amount: 1180000,
        },
      },
    },
  });

  const signature = signWebhook(payload, secret);

  // First delivery
  const res1 = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/razorpay",
    headers: { "content-type": "application/json", "x-razorpay-signature": signature },
    payload,
  });
  assert.equal(res1.statusCode, 200);

  // Second delivery (replay / retry)
  const res2 = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/razorpay",
    headers: { "content-type": "application/json", "x-razorpay-signature": signature },
    payload,
  });
  assert.equal(res2.statusCode, 200);
  const body2 = res2.json();
  assert.equal(body2.deduped, true);
});
