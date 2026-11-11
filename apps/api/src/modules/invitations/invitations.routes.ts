import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CreateInvitationSchema,
  AcceptInvitationSchema,
  generateSecureToken,
  hashToken,
  hashPassword,
  addDuration,
  DURATIONS,
} from "@kryptonix/shared";
import { prisma } from "../../db/prisma.ts";
import { requireOrgPermission } from "../../plugins/rbac.ts";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../plugins/error-handler.ts";
import { recordAudit } from "../../plugins/audit.ts";
import { sendEmail, invitationEmail } from "../../services/email.ts";
import { env } from "../../config.ts";

export async function invitationRoutes(app: FastifyInstance) {
  // Client Owner/Admin invites a teammate into their organization.
  app.post("/organizations/:id/invitations", async (request, reply) => {
    const { id: organizationId } = z.object({ id: z.string().cuid() }).parse(request.params);
    const actor = await requireOrgPermission(request, organizationId, "org.manage_members");
    const input = CreateInvitationSchema.parse(request.body);

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      const alreadyMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: existingUser.id } },
      });
      if (alreadyMember) throw new ConflictError("This person is already a member");
    }

    const token = generateSecureToken();
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    const invitation = await prisma.invitation.create({
      data: {
        organizationId,
        invitedByUserId: actor.userId,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(token),
        expiresAt: addDuration(new Date(), DURATIONS.INVITATION_MS),
      },
    });

    const link = `${env.CLIENT_WEB_URL}/accept-invitation?token=${token}`;
    await sendEmail({ to: input.email, ...invitationEmail(organization.name, link) });

    await recordAudit({
      organizationId,
      actorUserId: actor.userId,
      action: "invitation.created",
      entityType: "Invitation",
      entityId: invitation.id,
      metaJson: { email: input.email, role: input.role },
    });

    return reply.status(201).send({ data: { id: invitation.id, expiresAt: invitation.expiresAt } });
  });

  app.get("/organizations/:id/invitations", async (request, reply) => {
    const { id: organizationId } = z.object({ id: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "org.manage_members");

    const invitations = await prisma.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: invitations });
  });

  app.post("/organizations/:id/invitations/:invitationId/revoke", async (request, reply) => {
    const { id: organizationId, invitationId } = z
      .object({ id: z.string().cuid(), invitationId: z.string().cuid() })
      .parse(request.params);
    const actor = await requireOrgPermission(request, organizationId, "org.manage_members");

    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!invitation) throw new NotFoundError("Invitation not found");
    if (invitation.status !== "PENDING") throw new ConflictError("Invitation is not pending");

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    await recordAudit({
      organizationId,
      actorUserId: actor.userId,
      action: "invitation.revoked",
      entityType: "Invitation",
      entityId: invitationId,
    });

    return reply.send({ message: "Invitation revoked" });
  });

  // Public: accept an invitation using the emailed token. Creates the user
  // if they don't exist yet, or links an existing account.
  app.post("/invitations/accept", async (request, reply) => {
    const input = AcceptInvitationSchema.parse(request.body);
    const tokenHash = hashToken(input.token);

    const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
    if (!invitation) throw new UnauthorizedError("Invalid invitation");
    if (invitation.status !== "PENDING") throw new UnauthorizedError("Invitation already used or revoked");
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
      throw new UnauthorizedError("Invitation has expired");
    }

    let user = await prisma.user.findUnique({ where: { email: invitation.email } });

    await prisma.$transaction(async (tx) => {
      if (!user) {
        const passwordHash = await hashPassword(input.password);
        user = await tx.user.create({
          data: {
            email: invitation.email,
            fullName: input.fullName,
            passwordHash,
            userType: "CLIENT",
            status: "ACTIVE", // invited members skip the public-approval queue
            emailVerifiedAt: new Date(),
          },
        });
      }

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: { organizationId: invitation.organizationId, userId: user.id },
        },
        create: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
        update: { role: invitation.role },
      });

      // Single-use: mark accepted so the token can never be replayed.
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
    });

    await recordAudit({
      organizationId: invitation.organizationId,
      actorUserId: user!.id,
      action: "invitation.accepted",
      entityType: "Invitation",
      entityId: invitation.id,
    });

    return reply.send({ message: "Invitation accepted. You can now sign in." });
  });
}
