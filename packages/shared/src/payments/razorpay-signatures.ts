// Razorpay signature verification, implemented directly against their
// documented HMAC-SHA256 scheme (no SDK needed for this part — keeping it
// dependency-free makes it easy to unit test and easy to audit).
//
// Two distinct signatures matter and must NEVER be confused:
//
// 1. Checkout response signature (client → backend): HMAC_SHA256(
//      order_id + "|" + payment_id, key_secret)
//    Verifies the payment the mobile app reports actually belongs to the
//    order *we* created — this is the "never trust the client" check.
//
// 2. Webhook signature (Razorpay → backend): HMAC_SHA256(raw request body,
//    webhook_secret)
//    Verifies the webhook truly came from Razorpay. Must be computed over
//    the exact raw bytes of the request body, before any JSON parsing.

import { createHmac, timingSafeEqual } from "node:crypto";

function hmacHex(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = hmacHex(
    `${params.orderId}|${params.paymentId}`,
    params.keySecret,
  );
  return safeEqualHex(expected, params.signature);
}

export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  const expected = hmacHex(params.rawBody, params.webhookSecret);
  return safeEqualHex(expected, params.signature);
}
