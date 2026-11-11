import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "./razorpay-signatures.ts";
import { createHmac } from "node:crypto";

const KEY_SECRET = "rzp_test_key_secret";
const WEBHOOK_SECRET = "rzp_test_webhook_secret";

test("accepts a correctly computed checkout signature", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";
  const signature = createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(
    verifyCheckoutSignature({ orderId, paymentId, signature, keySecret: KEY_SECRET }),
    true,
  );
});

test("rejects a checkout signature for a different order (never trust client)", () => {
  const signature = createHmac("sha256", KEY_SECRET)
    .update("order_ABC123|pay_XYZ789")
    .digest("hex");

  // Attacker reuses a valid signature but swaps in a different order id.
  assert.equal(
    verifyCheckoutSignature({
      orderId: "order_DIFFERENT",
      paymentId: "pay_XYZ789",
      signature,
      keySecret: KEY_SECRET,
    }),
    false,
  );
});

test("accepts a correctly computed webhook signature over the raw body", () => {
  const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  assert.equal(
    verifyWebhookSignature({ rawBody, signature, webhookSecret: WEBHOOK_SECRET }),
    true,
  );
});

test("rejects a webhook with a tampered body", () => {
  const rawBody = JSON.stringify({ event: "payment.captured", payload: { amount: 100 } });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const tamperedBody = JSON.stringify({ event: "payment.captured", payload: { amount: 999999 } });

  assert.equal(
    verifyWebhookSignature({ rawBody: tamperedBody, signature, webhookSecret: WEBHOOK_SECRET }),
    false,
  );
});

test("rejects a webhook signed with the wrong secret", () => {
  const rawBody = JSON.stringify({ event: "payment.captured" });
  const signature = createHmac("sha256", "wrong_secret").update(rawBody).digest("hex");

  assert.equal(
    verifyWebhookSignature({ rawBody, signature, webhookSecret: WEBHOOK_SECRET }),
    false,
  );
});
