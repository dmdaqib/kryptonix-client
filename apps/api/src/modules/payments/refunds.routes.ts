import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { toSmallestUnit } from "@kryptonix/shared";
import { prisma } from "../../db/prisma.ts";
import { requireOrgPermission, requireStaffPermission } from "../../plugins/rbac.ts";
import { ConflictError, NotFoundError } from "../../plugins/error-handler.ts";
import { getPaymentProvider } from "./razorpay.provider.ts";
import { recordAudit } from "../../plugins/audit.ts";

const RequestRefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(3).max(500),
});

const ReviewRefundSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(500).optional(),
});

export async function refundRoutes(app: FastifyInstance) {
  // Client: request a refund on a successful payment.
  app.post("/payments/:id/refunds", async (request, reply) => {
    const { id: paymentId } = z.object({ id: z.string().cuid() }).parse(request.params);
    const input = RequestRefundSchema.parse(request.body);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
    if (!payment) throw new NotFoundError("Payment not found");
    const actor = await requireOrgPermission(request, payment.invoice.organizationId, "invoices.refund.request");

    if (payment.status !== "SUCCEEDED") throw new ConflictError("Only a succeeded payment can be refunded");
    if (input.amount > Number(payment.amount)) throw new ConflictError("Refund amount exceeds the payment amount");

    const refund = await prisma.refund.create({
      data: { paymentId, amount: input.amount, reason: input.reason, status: "REQUESTED" },
    });

    await recordAudit({
      organizationId: payment.invoice.organizationId,
      actorUserId: actor.userId,
      action: "refund.requested",
      entityType: "Refund",
      entityId: refund.id,
      metaJson: { amount: input.amount },
    });

    return reply.status(201).send({ data: refund });
  });

  // Finance Manager (staff): review a refund request.
  app.post("/refunds/:id/review", async (request, reply) => {
    const staff = requireStaffPermission(request, "invoices.refund.approve");
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const input = ReviewRefundSchema.parse(request.body);

    const refund = await prisma.refund.findUnique({ where: { id }, include: { payment: true } });
    if (!refund) throw new NotFoundError("Refund not found");
    if (refund.status !== "REQUESTED" && refund.status !== "UNDER_REVIEW") {
      throw new ConflictError(`Refund is already ${refund.status.toLowerCase()}`);
    }

    if (input.decision === "REJECTED") {
      await prisma.refund.update({
        where: { id },
        data: { status: "REJECTED", reviewedByUserId: staff.id },
      });
      await recordAudit({
        actorUserId: staff.id,
        action: "refund.rejected",
        entityType: "Refund",
        entityId: id,
      });
      return reply.send({ message: "Refund rejected" });
    }

    if (!refund.payment.providerPaymentId) {
      throw new ConflictError("Payment has no provider payment id to refund against");
    }

    await prisma.refund.update({
      where: { id },
      data: { status: "PROCESSING", reviewedByUserId: staff.id },
    });

    const provider = getPaymentProvider();
    const providerRefund = await provider.createRefund({
      providerPaymentId: refund.payment.providerPaymentId,
      amount: toSmallestUnit(Number(refund.amount)),
      notes: { refundId: refund.id },
    });

    await prisma.refund.update({
      where: { id },
      data: { providerRefundId: providerRefund.providerRefundId },
    });

    await recordAudit({
      actorUserId: staff.id,
      action: "refund.approved",
      entityType: "Refund",
      entityId: id,
    });

    // Final COMPLETED status is set by the refund.processed webhook, not
    // here — same "never trust the synchronous response" rule as payments.
    return reply.send({ message: "Refund approved and submitted to the payment provider" });
  });

  app.get("/organizations/:organizationId/refunds", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "invoices.view");

    const refunds = await prisma.refund.findMany({
      where: { payment: { invoice: { organizationId } } },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: refunds });
  });
}
