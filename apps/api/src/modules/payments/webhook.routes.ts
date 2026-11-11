import type { FastifyInstance } from "fastify";
import { getPaymentProvider } from "./razorpay.provider.ts";
import { prisma } from "../../db/prisma.ts";
import { fromSmallestUnit } from "@kryptonix/shared";

interface RazorpayWebhookBody {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; method?: string; status: string } };
    refund?: { entity: { id: string; payment_id: string; status: string; amount: number } };
  };
}

/**
 * Registered in its own encapsulated plugin scope so we can override the
 * JSON content-type parser to also keep the exact raw bytes — Razorpay's
 * webhook signature is computed over the raw body, and re-serializing a
 * parsed object is not guaranteed to byte-for-byte match what they signed.
 */
export async function webhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        const json = JSON.parse(body as string);
        done(null, { raw: body as string, json });
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post("/webhooks/razorpay", async (request, reply) => {
    const { raw, json } = request.body as { raw: string; json: RazorpayWebhookBody };
    const signature = request.headers["x-razorpay-signature"] as string | undefined;

    if (!signature) return reply.status(400).send({ error: { code: "MISSING_SIGNATURE" } });

    const provider = getPaymentProvider();
    const signatureValid = provider.verifyWebhookSignature({ rawBody: raw, signature });

    // Every event is in the queue even if invalid, for forensics — but
    // invalid ones are never acted on below.
    const providerEventId =
      json.payload.payment?.entity.id ?? json.payload.refund?.entity.id ?? `${json.event}-${Date.now()}`;

    const existing = await prisma.paymentWebhookEvent.findUnique({
      where: { provider_providerEventId: { provider: provider.name, providerEventId } },
    });

    // Idempotency: a webhook Razorpay retries (or an attacker replays)
    // never gets processed twice.
    if (existing?.processedAt) {
      return reply.send({ received: true, deduped: true });
    }

    const eventRecord = await prisma.paymentWebhookEvent.upsert({
      where: { provider_providerEventId: { provider: provider.name, providerEventId } },
      create: {
        provider: provider.name,
        providerEventId,
        eventType: json.event,
        signatureValid,
        rawPayload: json,
      },
      update: { signatureValid, rawPayload: json },
    });

    if (!signatureValid) {
      request.log.warn({ providerEventId }, "Razorpay webhook signature invalid; ignoring");
      return reply.status(400).send({ error: { code: "INVALID_SIGNATURE" } });
    }

    await processVerifiedEvent(json);

    await prisma.paymentWebhookEvent.update({
      where: { id: eventRecord.id },
      data: { processedAt: new Date() },
    });

    return reply.send({ received: true });
  });
}

async function processVerifiedEvent(body: RazorpayWebhookBody) {
  switch (body.event) {
    case "payment.captured":
      if (body.payload.payment) await handlePaymentCaptured(body.payload.payment.entity);
      break;
    case "payment.failed":
      if (body.payload.payment) await handlePaymentFailed(body.payload.payment.entity);
      break;
    case "refund.processed":
      if (body.payload.refund) await handleRefundProcessed(body.payload.refund.entity);
      break;
    default:
      // Unhandled event types are stored (above) but intentionally no-op.
      break;
  }
}

async function handlePaymentCaptured(entity: { id: string; order_id: string; amount: number; method?: string }) {
  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: entity.order_id },
    include: { invoice: true, schedule: true },
  });
  if (!payment) return; // order not created by us — ignore

  if (payment.status === "SUCCEEDED") return; // already processed, idempotent no-op

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", providerPaymentId: entity.id, method: entity.method },
    });

    await tx.paymentAttempt.create({
      data: { paymentId: payment.id, status: "SUCCEEDED", rawPayload: entity },
    });

    const amountPaid = fromSmallestUnit(entity.amount);

    const invoice = await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { amountPaid: { increment: amountPaid } },
    });

    if (Number(invoice.amountPaid) >= Number(invoice.totalAmount)) {
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
    } else {
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PARTIALLY_PAID" } });
    }

    if (payment.scheduleId) {
      await tx.paymentSchedule.update({ where: { id: payment.scheduleId }, data: { status: "PAID" } });
    }

    const receiptNumber = `KX-RCPT-${Date.now()}-${payment.id.slice(-6)}`;
    await tx.receipt.create({ data: { paymentId: payment.id, receiptNumber } });

    // TODO(notifications): enqueue "payment.successful" push + email here
    // once the notification dispatcher (P5) is wired up.
  });
}

async function handlePaymentFailed(entity: { id: string; order_id: string }) {
  const payment = await prisma.payment.findUnique({ where: { providerOrderId: entity.order_id } });
  if (!payment || payment.status === "SUCCEEDED") return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED", providerPaymentId: entity.id },
  });
  await prisma.paymentAttempt.create({
    data: { paymentId: payment.id, status: "FAILED", rawPayload: entity },
  });
}

async function handleRefundProcessed(entity: { id: string; payment_id: string; status: string }) {
  const refund = await prisma.refund.findFirst({
    where: { payment: { providerPaymentId: entity.payment_id } },
    orderBy: { createdAt: "desc" },
  });
  if (!refund || refund.status === "COMPLETED") return;

  await prisma.refund.update({
    where: { id: refund.id },
    data: { status: "COMPLETED", providerRefundId: entity.id },
  });
}
