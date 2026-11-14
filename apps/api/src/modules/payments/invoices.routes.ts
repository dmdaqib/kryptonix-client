import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { computeInvoiceTotals, validateScheduleSumsToTotal } from "@kryptonix/shared";
import { prisma } from "../../db/prisma.ts";
import { requireOrgPermission, requireStaffPermission } from "../../plugins/rbac.ts";
import { ConflictError, NotFoundError } from "../../plugins/error-handler.ts";
import { recordAudit } from "../../plugins/audit.ts";

const InvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).default(0),
});

const ScheduleEntrySchema = z.object({
  label: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.coerce.date(),
});

const CreateInvoiceSchema = z.object({
  organizationId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  quoteId: z.string().cuid().optional(),
  dueDate: z.coerce.date(),
  paymentTerms: z.string().optional(),
  discountAmount: z.number().nonnegative().default(0),
  currency: z.string().default("INR"),
  items: z.array(InvoiceItemSchema).min(1),
  // Optional instalment plan — e.g. 40% advance / 40% milestone / 20% final.
  // Omit for a standard single full-payment invoice.
  schedule: z.array(ScheduleEntrySchema).optional(),
});

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `KX-INV-${year}-` } },
  });
  return `KX-INV-${year}-${String(count + 1).padStart(5, "0")}`;
}

async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.quote.count({
    where: { quoteNumber: { startsWith: `KX-QT-${year}-` } },
  });
  return `KX-QT-${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function invoiceRoutes(app: FastifyInstance) {
  // Finance Manager (staff) creates an invoice for a client organization.
  app.post("/invoices", async (request, reply) => {
    const staff = requireStaffPermission(request, "invoices.create");
    const input = CreateInvoiceSchema.parse(request.body);

    const totals = computeInvoiceTotals(input.items, input.discountAmount);

    if (input.schedule && !validateScheduleSumsToTotal(input.schedule.map((s) => s.amount), totals.total)) {
      throw new ConflictError("Instalment schedule does not sum to the invoice total");
    }

    const invoiceNumber = await nextInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        quoteId: input.quoteId,
        invoiceNumber,
        status: "SENT",
        dueDate: input.dueDate,
        paymentTerms: input.paymentTerms,
        currency: input.currency,
        subtotalAmount: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        items: {
          create: input.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxPercent: item.taxPercent,
            lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
          })),
        },
        schedules: input.schedule
          ? {
              create: input.schedule.map((s, i) => ({
                label: s.label,
                amount: s.amount,
                dueDate: s.dueDate,
                projectId: input.projectId,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { items: true, schedules: true },
    });

    await recordAudit({
      organizationId: input.organizationId,
      actorUserId: staff.id,
      action: "invoice.created",
      entityType: "Invoice",
      entityId: invoice.id,
      metaJson: { total: totals.total },
    });

    return reply.status(201).send({ data: invoice });
  });

  // Client: buy a fixed-price package directly — no staff involvement needed.
  // Creates an auto-accepted Quote (so there's a clean paper trail of what
  // was agreed) and an immediately payable Invoice with a real GST/tax
  // breakdown, in a single step. The mobile app sends the customer straight
  // from this response into the existing invoice-detail/Razorpay pay screen.
  app.post("/organizations/:organizationId/packages/:packageId/purchase", async (request, reply) => {
    const { organizationId, packageId } = z
      .object({ organizationId: z.string().cuid(), packageId: z.string().cuid() })
      .parse(request.params);

    const bodySchema = z
      .object({
        paymentSchedule: z.enum(["FULL", "ADVANCE_50"]).default("FULL"),
        discountCode: z.string().optional(),
        customerDetails: z
          .object({
            businessName: z.string().optional(),
            gstin: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
          })
          .optional(),
      })
      .optional();

    const body = bodySchema.parse(request.body ?? {}) ?? { paymentSchedule: "FULL" };

    const actor = await requireOrgPermission(request, organizationId, "quotes.accept");

    const pkg = await prisma.servicePackage.findUnique({
      where: { id: packageId },
      include: { service: true, features: true },
    });
    if (!pkg || !pkg.isAvailable) {
      throw new NotFoundError("This package is not available for purchase");
    }

    // Prices and tax always come from the backend record, never from the
    // client request — the mobile app only ever sends a packageId.
    const unitPrice = Number(pkg.priceAmount);
    const taxPercent = Number(pkg.taxPercent) || 18; // standard 18% GST for digital services

    // Validated discount codes
    let discountAmount = 0;
    if (body.discountCode) {
      const code = body.discountCode.trim().toUpperCase();
      if (code === "KRYPTON10") {
        discountAmount = Math.round(unitPrice * 0.1);
      } else if (code === "LAUNCH20") {
        discountAmount = Math.round(unitPrice * 0.2);
      }
    }

    const description = `${pkg.service.name} — ${pkg.name}`;
    const totals = computeInvoiceTotals([{ quantity: 1, unitPrice, taxPercent }], discountAmount);

    const [quoteNumber, invoiceNumber] = await Promise.all([nextQuoteNumber(), nextInvoiceNumber()]);

    const { quote, invoice, project } = await prisma.$transaction(async (tx) => {
      // 1. Create Accepted Quote
      const quote = await tx.quote.create({
        data: {
          organizationId,
          createdByUserId: actor.userId,
          quoteNumber,
          status: "ACCEPTED",
          scopeOfWork: description,
          subtotalAmount: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.total,
          currency: pkg.currency,
          paymentTerms: body.paymentSchedule === "ADVANCE_50" ? "50% Advance, 50% on Final Handover" : pkg.paymentTerms,
          items: {
            create: [
              {
                packageId: pkg.id,
                description,
                quantity: 1,
                unitPrice,
                lineTotal: Math.round(unitPrice * 100) / 100,
              },
            ],
          },
        },
      });

      await tx.quoteAcceptance.create({
        data: {
          quoteId: quote.id,
          acceptedByUserId: actor.userId,
          acceptedQuoteVersion: quote.version,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        },
      });

      // 2. Create Active Project for the Client Workspace
      const durationDays = pkg.expectedDurationDays ?? 30;
      const startDate = new Date();
      const targetDeliveryDate = new Date();
      targetDeliveryDate.setDate(targetDeliveryDate.getDate() + durationDays);

      const project = await tx.project.create({
        data: {
          organizationId,
          name: `${pkg.service.name} (${pkg.name})`,
          description: pkg.description,
          status: "IN_PROGRESS",
          startDate,
          expectedDeliveryDate: targetDeliveryDate,
        },
      });

      // 3. Create Project Milestones based on package deliverables
      const m1Due = new Date();
      m1Due.setDate(m1Due.getDate() + Math.max(3, Math.floor(durationDays * 0.2)));
      const m2Due = new Date();
      m2Due.setDate(m2Due.getDate() + Math.max(10, Math.floor(durationDays * 0.65)));
      const m3Due = targetDeliveryDate;

      await tx.milestone.createMany({
        data: [
          {
            projectId: project.id,
            name: "Discovery, Wireframes & Architecture",
            description: "Requirements finalization, design system tokens and project setup.",
            status: "IN_PROGRESS",
            requiresClientApproval: true,
            dueDate: m1Due,
          },
          {
            projectId: project.id,
            name: "Core System Implementation & Integration",
            description: "Implementation of primary modules, backend services and client flows.",
            status: "NOT_STARTED",
            requiresClientApproval: true,
            dueDate: m2Due,
          },
          {
            projectId: project.id,
            name: "Testing, Deliverables Review & Production Handover",
            description: "End-to-end quality assurance, client acceptance review, deployment and documentation.",
            status: "NOT_STARTED",
            requiresClientApproval: true,
            dueDate: m3Due,
          },
        ],
      });

      // 4. Create Project Conversation for client-team messaging
      await tx.conversation.create({
        data: {
          projectId: project.id,
          title: `Project Chat — ${project.name}`,
          members: {
            create: [{ userId: actor.userId }],
          },
        },
      });

      // 5. Create Invoice
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const isAdvance50 = body.paymentSchedule === "ADVANCE_50";
      const advanceAmount = Math.round((totals.total / 2) * 100) / 100;
      const finalAmount = Math.round((totals.total - advanceAmount) * 100) / 100;

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          projectId: project.id,
          quoteId: quote.id,
          invoiceNumber,
          status: "SENT",
          dueDate,
          paymentTerms: isAdvance50 ? "50% Advance, 50% on Handover" : pkg.paymentTerms,
          currency: pkg.currency,
          subtotalAmount: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.total,
          items: {
            create: [
              {
                description,
                quantity: 1,
                unitPrice,
                taxPercent,
                lineTotal: Math.round(unitPrice * 100) / 100,
              },
            ],
          },
          schedules: isAdvance50
            ? {
                create: [
                  {
                    label: "50% Advance Kickoff Payment",
                    amount: advanceAmount,
                    dueDate,
                    projectId: project.id,
                    sortOrder: 0,
                  },
                  {
                    label: "50% Milestone & Delivery Handover",
                    amount: finalAmount,
                    dueDate: targetDeliveryDate,
                    projectId: project.id,
                    sortOrder: 1,
                  },
                ],
              }
            : undefined,
        },
        include: { items: true, schedules: true },
      });

      return { quote, invoice, project };
    });

    await recordAudit({
      organizationId,
      actorUserId: actor.userId,
      action: "package.purchased",
      entityType: "Invoice",
      entityId: invoice.id,
      metaJson: { packageId, quoteId: quote.id, projectId: project.id, total: totals.total },
    });

    return reply.status(201).send({
      data: {
        ...invoice,
        projectId: project.id,
      },
    });
  });

  // Client: list invoices for their organization.
  app.get("/organizations/:organizationId/invoices", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "invoices.view");

    const invoices = await prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { schedules: true },
    });
    return reply.send({ data: invoices });
  });

  app.get("/invoices/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, schedules: true, payments: true },
    });
    if (!invoice) throw new NotFoundError("Invoice not found");

    await requireOrgPermission(request, invoice.organizationId, "invoices.view");
    return reply.send({ data: invoice });
  });
}
