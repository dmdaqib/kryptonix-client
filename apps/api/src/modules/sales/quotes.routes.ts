import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { computeInvoiceTotals } from "@kryptonix/shared";
import { prisma } from "../../db/prisma.ts";
import { requireOrgPermission, requireStaffPermission } from "../../plugins/rbac.ts";
import { ConflictError, NotFoundError } from "../../plugins/error-handler.ts";
import { recordAudit } from "../../plugins/audit.ts";

const QuoteItemInputSchema = z.object({
  packageId: z.string().cuid().optional(),
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
});

const CreateQuoteSchema = z.object({
  organizationId: z.string().cuid(),
  enquiryId: z.string().cuid().optional(),
  scopeOfWork: z.string().min(10),
  exclusions: z.string().optional(),
  discountAmount: z.number().nonnegative().default(0),
  currency: z.string().default("INR"),
  paymentTerms: z.string().optional(),
  validUntil: z.coerce.date().optional(),
  items: z.array(QuoteItemInputSchema).min(1),
});

async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.quote.count({ where: { quoteNumber: { startsWith: `KX-QT-${year}-` } } });
  return `KX-QT-${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function quoteRoutes(app: FastifyInstance) {
  app.post("/quotes", async (request, reply) => {
    const staff = requireStaffPermission(request, "quotes.create");
    const input = CreateQuoteSchema.parse(request.body);

    const itemsWithTax = input.items.map((i) => ({ ...i, taxPercent: 18 })); // default GST; configurable later
    const totals = computeInvoiceTotals(itemsWithTax, input.discountAmount);
    const quoteNumber = await nextQuoteNumber();

    const quote = await prisma.quote.create({
      data: {
        organizationId: input.organizationId,
        enquiryId: input.enquiryId,
        createdByUserId: staff.id,
        quoteNumber,
        status: "DRAFT",
        scopeOfWork: input.scopeOfWork,
        exclusions: input.exclusions,
        subtotalAmount: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        currency: input.currency,
        paymentTerms: input.paymentTerms,
        validUntil: input.validUntil,
        items: {
          create: input.items.map((item) => ({
            packageId: item.packageId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
          })),
        },
      },
      include: { items: true },
    });

    return reply.status(201).send({ data: quote });
  });

  app.post("/quotes/:id/send", async (request, reply) => {
    const staff = requireStaffPermission(request, "quotes.send");
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundError("Quote not found");
    if (quote.status !== "DRAFT" && quote.status !== "REVISION_REQUESTED") {
      throw new ConflictError(`Cannot send a quote in status ${quote.status}`);
    }

    await prisma.quote.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    if (quote.enquiryId) {
      await prisma.enquiry.update({ where: { id: quote.enquiryId }, data: { status: "QUOTED" } });
    }

    await recordAudit({
      organizationId: quote.organizationId,
      actorUserId: staff.id,
      action: "quote.sent",
      entityType: "Quote",
      entityId: id,
    });

    // TODO(notifications): push + email "quotation received" to the client.
    return reply.send({ message: "Quote sent to client" });
  });

  app.get("/organizations/:organizationId/quotes", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "quotes.view");

    const quotes = await prisma.quote.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { items: true, acceptance: true },
    });
    return reply.send({ data: quotes });
  });

  app.get("/quotes/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: true, revisions: true, acceptance: true },
    });
    if (!quote) throw new NotFoundError("Quote not found");

    await requireOrgPermission(request, quote.organizationId, "quotes.view");

    if (!quote.viewedAt) {
      await prisma.quote.update({ where: { id }, data: { status: "VIEWED", viewedAt: new Date() } });
    }
    return reply.send({ data: quote });
  });

  // Client: accept a quote. This records acceptance evidence but is
  // explicitly NOT represented as a legally-binding e-signature — see
  // docs/security.md §E-signature before relying on it contractually.
  app.post("/quotes/:id/accept", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundError("Quote not found");
    const actor = await requireOrgPermission(request, quote.organizationId, "quotes.accept");

    if (quote.status !== "SENT" && quote.status !== "VIEWED") {
      throw new ConflictError(`Cannot accept a quote in status ${quote.status}`);
    }
    if (quote.validUntil && quote.validUntil < new Date()) {
      await prisma.quote.update({ where: { id }, data: { status: "EXPIRED" } });
      throw new ConflictError("This quote has expired");
    }

    await prisma.$transaction([
      prisma.quote.update({ where: { id }, data: { status: "ACCEPTED" } }),
      prisma.quoteAcceptance.create({
        data: {
          quoteId: id,
          acceptedByUserId: actor.userId,
          acceptedQuoteVersion: quote.version,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        },
      }),
      prisma.enquiry.updateMany({
        where: { id: quote.enquiryId ?? undefined },
        data: { status: "CONVERTED" },
      }),
    ]);

    await recordAudit({
      organizationId: quote.organizationId,
      actorUserId: actor.userId,
      action: "quote.accepted",
      entityType: "Quote",
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.send({ message: "Quote accepted" });
  });

  app.post("/quotes/:id/reject", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundError("Quote not found");
    const actor = await requireOrgPermission(request, quote.organizationId, "quotes.accept");

    await prisma.quote.update({ where: { id }, data: { status: "REJECTED" } });
    await recordAudit({
      organizationId: quote.organizationId,
      actorUserId: actor.userId,
      action: "quote.rejected",
      entityType: "Quote",
      entityId: id,
    });
    return reply.send({ message: "Quote rejected" });
  });

  app.post("/quotes/:id/request-revision", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const { notes } = z.object({ notes: z.string().min(3) }).parse(request.body);

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundError("Quote not found");
    const actor = await requireOrgPermission(request, quote.organizationId, "quotes.accept");

    await prisma.$transaction([
      prisma.quote.update({ where: { id }, data: { status: "REVISION_REQUESTED" } }),
      prisma.quoteRevision.create({
        data: {
          quoteId: id,
          version: quote.version,
          snapshotJson: quote as unknown as object,
          changeSummary: notes,
        },
      }),
    ]);

    await recordAudit({
      organizationId: quote.organizationId,
      actorUserId: actor.userId,
      action: "quote.revision_requested",
      entityType: "Quote",
      entityId: id,
      metaJson: { notes },
    });

    return reply.send({ message: "Revision requested" });
  });
}
