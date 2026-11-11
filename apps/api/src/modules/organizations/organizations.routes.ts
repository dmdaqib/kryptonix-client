import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireStaffPermission } from "../../plugins/rbac.ts";
import { requireAuth } from "../../plugins/auth.ts";
import { NotFoundError } from "../../plugins/error-handler.ts";
import { recordAudit } from "../../plugins/audit.ts";
import { sendEmail, accountApprovedEmail } from "../../services/email.ts";

export async function organizationRoutes(app: FastifyInstance) {
  // Staff: list organizations pending approval.
  app.get("/organizations/pending", async (request, reply) => {
    requireStaffPermission(request, "staff.manage_clients");
    const pending = await prisma.organization.findMany({
      where: { approvedAt: null },
      include: { members: { include: { user: true }, where: { role: "OWNER" } } },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ data: pending });
  });

  // Staff: approve an organization, activating its owner's account.
  app.post("/organizations/:id/approve", async (request, reply) => {
    const staff = requireStaffPermission(request, "staff.manage_clients");
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { members: { where: { role: "OWNER" }, include: { user: true } } },
    });
    if (!organization) throw new NotFoundError("Organization not found");

    await prisma.$transaction([
      prisma.organization.update({
        where: { id },
        data: { approvedAt: new Date(), approvedByUserId: staff.id },
      }),
      prisma.user.updateMany({
        where: { id: { in: organization.members.map((m) => m.userId) } },
        data: { status: "ACTIVE" },
      }),
    ]);

    await recordAudit({
      organizationId: id,
      actorUserId: staff.id,
      action: "organization.approved",
      entityType: "Organization",
      entityId: id,
    });

    for (const member of organization.members) {
      await sendEmail({ to: member.user.email, ...accountApprovedEmail() });
    }

    return reply.send({ message: "Organization approved" });
  });

  // Client: view my organization + members (requires membership, enforced below).
  app.get("/organizations/:id", async (request, reply) => {
    const authUser = requireAuth(request);
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId: authUser.id } },
    });
    if (authUser.userType === "CLIENT" && !membership) {
      throw new NotFoundError("Organization not found");
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { members: { include: { user: true } }, addresses: true },
    });
    if (!organization) throw new NotFoundError("Organization not found");

    return reply.send({
      data: {
        id: organization.id,
        name: organization.name,
        businessCategory: organization.businessCategory,
        country: organization.country,
        approved: Boolean(organization.approvedAt),
        members: organization.members.map((m) => ({
          userId: m.userId,
          fullName: m.user.fullName,
          email: m.user.email,
          role: m.role,
        })),
        addresses: organization.addresses,
      },
    });
  });
}
