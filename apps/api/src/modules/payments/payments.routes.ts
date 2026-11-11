import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toSmallestUnit } from "@kryptonix/shared";
import { prisma } from "../../db/prisma.ts";
import { requireOrgPermission } from "../../plugins/rbac.ts";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../plugins/error-handler.ts";
import { getPaymentProvider } from "./razorpay.provider.ts";
import { env } from "../../config.ts";
import { recordAudit } from "../../plugins/audit.ts";

const CreatePaymentOrderSchema = z.object({
  scheduleId: z.string().cuid().optional(),
});

const ConfirmPaymentSchema = z.object({
  providerPaymentId: z.string().min(1),
  signature: z.string().min(1),
  method: z.string().optional(),
});

export async function paymentRoutes(app: FastifyInstance) {
  // Step 1: client asks us to create a gateway order for an invoice (or one
  // instalment of it). WE decide the amount server-side — it is never taken
  // from the request body, so a tampered client can't pay less than owed.
  app.post("/invoices/:id/pay", async (request, reply) => {
    const { id: invoiceId } = z.object({ id: z.string().cuid() }).parse(request.params);
    const input = CreatePaymentOrderSchema.parse(request.body ?? {});

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError("Invoice not found");
    await requireOrgPermission(request, invoice.organizationId, "invoices.pay");

    if (invoice.status === "PAID" || invoice.status === "VOID") {
      throw new ConflictError(`Invoice is already ${invoice.status.toLowerCase()}`);
    }

    let amount: number;
    let scheduleId: string | undefined;

    if (input.scheduleId) {
      const schedule = await prisma.paymentSchedule.findFirst({
        where: { id: input.scheduleId, invoiceId },
      });
      if (!schedule) throw new NotFoundError("Instalment not found on this invoice");
      if (schedule.status === "PAID") throw new ConflictError("This instalment is already paid");
      amount = Number(schedule.amount);
      scheduleId = schedule.id;
    } else {
      amount = Number(invoice.totalAmount) - Number(invoice.amountPaid);
      if (amount <= 0) throw new ConflictError("Nothing outstanding on this invoice");
    }

    const provider = getPaymentProvider();
    const order = await provider.createOrder({
      amount: toSmallestUnit(amount),
      currency: invoice.currency,
      receipt: `${invoice.invoiceNumber}-${Date.now()}`,
      notes: { invoiceId, scheduleId: scheduleId ?? "" },
    });

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        scheduleId,
        provider: provider.name,
        providerOrderId: order.providerOrderId,
        amount,
        currency: invoice.currency,
        status: "CREATED",
      },
    });

    // The mobile app opens Razorpay Checkout with these three fields —
    // key_id is public by design; key_secret never leaves the server.
    return reply.status(201).send({
      data: {
        paymentId: payment.id,
        providerOrderId: order.providerOrderId,
        amount: order.amount,
        currency: order.currency,
        keyId: env.RAZORPAY_KEY_ID,
      },
    });
  });

  // Step 2: mobile app reports the checkout result. We verify the
  // signature so we know this really is OUR order being paid — but we do
  // NOT mark the invoice paid here. That only happens from the webhook
  // handler, independently, once Razorpay itself confirms the charge.
  app.post("/payments/:id/confirm", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const input = ConfirmPaymentSchema.parse(request.body);

    const payment = await prisma.payment.findUnique({ where: { id }, include: { invoice: true } });
    if (!payment) throw new NotFoundError("Payment not found");
    await requireOrgPermission(request, payment.invoice.organizationId, "invoices.pay");

    const provider = getPaymentProvider();
    const valid = provider.verifyCheckoutSignature({
      orderId: payment.providerOrderId,
      paymentId: input.providerPaymentId,
      signature: input.signature,
    });

    await prisma.paymentAttempt.create({
      data: { paymentId: payment.id, status: valid ? "PENDING" : "FAILED", rawPayload: input },
    });

    if (!valid) {
      await prisma.payment.update({ where: { id }, data: { status: "FAILED" } });
      throw new UnauthorizedError("Payment signature verification failed");
    }

    await prisma.payment.update({
      where: { id },
      data: { providerPaymentId: input.providerPaymentId, method: input.method, status: "PENDING" },
    });

    return reply.send({
      message: "Payment received and signature verified. Awaiting bank confirmation.",
      data: { status: "PENDING" },
    });
  });

  app.get("/organizations/:organizationId/payments", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "invoices.view");

    const payments = await prisma.payment.findMany({
      where: { invoice: { organizationId } },
      include: { invoice: true, receipt: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: payments });
  });
}
