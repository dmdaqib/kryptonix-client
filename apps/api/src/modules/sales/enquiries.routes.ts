import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireOrgPermission, requireStaffPermission, requireStaff } from "../../plugins/rbac.ts";
import { NotFoundError } from "../../plugins/error-handler.ts";
import { recordAudit } from "../../plugins/audit.ts";

const CreateEnquirySchema = z.object({
  organizationId: z.string().cuid(),
  serviceId: z.string().cuid().optional(),
  title: z.string().min(3),
  requirements: z.string().min(10),
  budgetRangeMin: z.number().nonnegative().optional(),
  budgetRangeMax: z.number().nonnegative().optional(),
  expectedTimeline: z.string().optional(),
});

export async function enquiryRoutes(app: FastifyInstance) {
  // Client: submit a custom requirement (Model B purchasing path).
  app.post("/enquiries", async (request, reply) => {
    const input = CreateEnquirySchema.parse(request.body);
    const actor = await requireOrgPermission(request, input.organizationId, "org.view");

    const enquiry = await prisma.enquiry.create({
      data: { ...input, createdByUserId: actor.userId },
    });

    await recordAudit({
      organizationId: input.organizationId,
      actorUserId: actor.userId,
      action: "enquiry.created",
      entityType: "Enquiry",
      entityId: enquiry.id,
    });

    // TODO(notifications): notify the sales team of a new enquiry (P5).
    return reply.status(201).send({ data: enquiry });
  });

  app.get("/organizations/:organizationId/enquiries", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "org.view");

    const enquiries = await prisma.enquiry.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: enquiries });
  });

  // Staff: sales queue.
  app.get("/staff/enquiries", async (request, reply) => {
    requireStaffPermission(request, "quotes.create");
    const { status } = z.object({ status: z.string().optional() }).parse(request.query);

    const enquiries = await prisma.enquiry.findMany({
      where: status ? { status: status as never } : undefined,
      include: { organization: true, service: true },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ data: enquiries });
  });

  app.post("/staff/enquiries/:id/assign", async (request, reply) => {
    const staff = requireStaff(request);
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const { assignedToUserId } = z.object({ assignedToUserId: z.string().cuid() }).parse(request.body);

    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) throw new NotFoundError("Enquiry not found");

    await prisma.enquiry.update({
      where: { id },
      data: { assignedToUserId, status: "IN_REVIEW" },
    });

    await recordAudit({
      organizationId: enquiry.organizationId,
      actorUserId: staff.id,
      action: "enquiry.assigned",
      entityType: "Enquiry",
      entityId: id,
      metaJson: { assignedToUserId },
    });

    return reply.send({ message: "Enquiry assigned" });
  });
}
