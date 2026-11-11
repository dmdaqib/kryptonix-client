import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireAuth } from "../../plugins/auth.ts";
import { requireOrgPermission, requireStaffPermission } from "../../plugins/rbac.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../../plugins/error-handler.ts";
import { recordAudit } from "../../plugins/audit.ts";
import { notifyOrganization, notifyStaffRole, notifyUser } from "../../plugins/notify.ts";

const CreateTicketSchema = z.object({
  category: z.string().min(1),
  subject: z.string().min(3),
  description: z.string().min(10),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

const AddMessageSchema = z.object({
  body: z.string().min(1),
  isInternalNote: z.boolean().default(false),
});

const AssignTicketSchema = z.object({
  assignedToUserId: z.string().cuid(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "AWAITING_CLIENT", "RESOLVED", "CLOSED"]),
});

/**
 * Resolves whether the current user may see a given ticket: staff with
 * support.manage_tickets can see every ticket; a client can only see
 * tickets raised by their own organization.
 */
async function requireTicketAccess(request: FastifyRequest, ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError("Ticket not found");

  const authUser = requireAuth(request);
  if (authUser.userType === "STAFF") {
    requireStaffPermission(request, "support.manage_tickets");
  } else {
    await requireOrgPermission(request, ticket.organizationId, "support.create_ticket");
  }
  return ticket;
}

export async function ticketRoutes(app: FastifyInstance) {
  // Client: raise a new support ticket for their organization.
  app.post("/organizations/:organizationId/tickets", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    const actor = await requireOrgPermission(request, organizationId, "support.create_ticket");
    const input = CreateTicketSchema.parse(request.body);

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId,
        openedByUserId: actor.userId,
        category: input.category,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        status: "OPEN",
      },
    });

    await recordAudit({
      organizationId,
      actorUserId: actor.userId,
      action: "ticket.created",
      entityType: "SupportTicket",
      entityId: ticket.id,
    });

    // Routed to the general support queue; whoever picks it up self-assigns
    // via POST /tickets/:id/assign.
    await notifyStaffRole("SUPPORT_STAFF", {
      type: "ticket.created",
      title: "New support ticket",
      body: `${input.subject} (${input.priority})`,
      metaJson: { ticketId: ticket.id, organizationId },
    });

    return reply.status(201).send({ data: ticket });
  });

  // Client: list their own organization's tickets.
  app.get("/organizations/:organizationId/tickets", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "support.create_ticket");

    const tickets = await prisma.supportTicket.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: tickets });
  });

  // Staff: the support queue across every organization.
  app.get("/tickets", async (request, reply) => {
    requireStaffPermission(request, "support.manage_tickets");
    const { status } = z
      .object({
        status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "AWAITING_CLIENT", "RESOLVED", "CLOSED"]).optional(),
      })
      .parse(request.query);

    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      include: { organization: { select: { id: true, name: true } } },
    });
    return reply.send({ data: tickets });
  });

  app.get("/tickets/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    await requireTicketAccess(request, id);

    const authUser = requireAuth(request);
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          // A client never sees staff-internal notes.
          where: authUser.userType === "STAFF" ? undefined : { isInternalNote: false },
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
      },
    });
    if (!ticket) throw new NotFoundError("Ticket not found");
    return reply.send({ data: ticket });
  });

  app.post("/tickets/:id/messages", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const ticket = await requireTicketAccess(request, id);
    const authUser = requireAuth(request);
    const input = AddMessageSchema.parse(request.body);

    if (ticket.status === "CLOSED") {
      throw new ConflictError("This ticket is closed; reopen it before replying");
    }
    if (input.isInternalNote && authUser.userType !== "STAFF") {
      throw new ForbiddenError("Only staff can post internal notes");
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: authUser.id,
        body: input.body,
        isInternalNote: input.isInternalNote,
      },
    });

    const nextStatus =
      authUser.userType === "STAFF"
        ? input.isInternalNote
          ? ticket.status
          : "AWAITING_CLIENT"
        : ticket.status === "AWAITING_CLIENT" || ticket.status === "RESOLVED"
          ? "IN_PROGRESS"
          : ticket.status;
    if (nextStatus !== ticket.status) {
      await prisma.supportTicket.update({ where: { id }, data: { status: nextStatus } });
    }

    if (!input.isInternalNote) {
      if (authUser.userType === "STAFF") {
        await notifyUser({
          userId: ticket.openedByUserId,
          type: "ticket.reply",
          title: "Support replied to your ticket",
          body: ticket.subject,
          metaJson: { ticketId: id },
        });
      } else if (ticket.assignedToUserId) {
        await notifyUser({
          userId: ticket.assignedToUserId,
          type: "ticket.reply",
          title: "Client replied to a ticket",
          body: ticket.subject,
          metaJson: { ticketId: id },
        });
      }
    }

    return reply.status(201).send({ data: message });
  });

  app.post("/tickets/:id/assign", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "support.manage_tickets");
    const input = AssignTicketSchema.parse(request.body);

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundError("Ticket not found");

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { assignedToUserId: input.assignedToUserId, status: "ASSIGNED" },
    });

    await recordAudit({
      organizationId: ticket.organizationId,
      actorUserId: staff.id,
      action: "ticket.assigned",
      entityType: "SupportTicket",
      entityId: id,
      metaJson: { assignedToUserId: input.assignedToUserId },
    });

    return reply.send({ data: updated });
  });

  app.post("/tickets/:id/status", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "support.manage_tickets");
    const { status } = UpdateStatusSchema.parse(request.body);

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundError("Ticket not found");

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : ticket.resolvedAt,
        closedAt: status === "CLOSED" ? new Date() : null,
      },
    });

    await recordAudit({
      organizationId: ticket.organizationId,
      actorUserId: staff.id,
      action: "ticket.status_changed",
      entityType: "SupportTicket",
      entityId: id,
      metaJson: { from: ticket.status, to: status },
    });

    if (status === "RESOLVED") {
      await notifyOrganization(ticket.organizationId, {
        type: "ticket.resolved",
        title: "Your support ticket was resolved",
        body: ticket.subject,
        metaJson: { ticketId: id },
      });
    }

    return reply.send({ data: updated });
  });
}
