import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireAuth } from "../../plugins/auth.ts";
import { requireOrgPermission } from "../../plugins/rbac.ts";
import { ForbiddenError, NotFoundError } from "../../plugins/error-handler.ts";
import { notifyUser } from "../../plugins/notify.ts";

const PostMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  isInternalNote: z.boolean().default(false),
});

/**
 * Every project gets exactly one running conversation thread, created
 * lazily the first time anyone opens it — simpler than a client picking a
 * conversation to start, and matches how the spec's messaging screens are
 * laid out (one thread per project, not per topic).
 */
async function ensureProjectConversation(projectId: string) {
  const existing = await prisma.conversation.findFirst({ where: { projectId } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { projectId } });
}

async function loadConversationAndProject(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError("Conversation not found");
  const project = await prisma.project.findUnique({ where: { id: conversation.projectId } });
  if (!project) throw new NotFoundError("Project not found");
  return { conversation, project };
}

export async function messagingRoutes(app: FastifyInstance) {
  app.get("/projects/:id/conversation", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundError("Project not found");
    await requireOrgPermission(request, project.organizationId, "projects.view");

    const conversation = await ensureProjectConversation(id);
    return reply.send({ data: conversation });
  });

  app.get("/conversations/:id/messages", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const { project } = await loadConversationAndProject(id);
    const authUser = requireAuth(request);
    await requireOrgPermission(request, project.organizationId, "projects.view");

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        deletedAt: null,
        // A client never sees an internal staff-only note.
        ...(authUser.userType === "STAFF" ? {} : { isInternalNote: false }),
      },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, fullName: true, userType: true } }, attachments: true },
    });
    return reply.send({ data: messages });
  });

  app.post("/conversations/:id/messages", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const { conversation, project } = await loadConversationAndProject(id);
    const authUser = requireAuth(request);
    await requireOrgPermission(request, project.organizationId, "projects.view");
    const input = PostMessageSchema.parse(request.body);

    if (input.isInternalNote && authUser.userType !== "STAFF") {
      throw new ForbiddenError("Only staff can post internal notes");
    }

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: id,
          senderId: authUser.id,
          body: input.body,
          isInternalNote: input.isInternalNote,
        },
        include: { sender: { select: { id: true, fullName: true, userType: true } } },
      }),
      prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: id, userId: authUser.id } },
        create: { conversationId: id, userId: authUser.id, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      }),
    ]);

    if (!input.isInternalNote) {
      const recipients =
        authUser.userType === "STAFF"
          ? await prisma.organizationMember.findMany({
              where: { organizationId: project.organizationId },
              select: { userId: true },
            })
          : (
              await prisma.projectMember.findMany({ where: { projectId: conversation.projectId }, select: { userId: true } })
            );
      await Promise.all(
        recipients
          .filter((r) => r.userId !== authUser.id)
          .map((r) =>
            notifyUser({
              userId: r.userId,
              type: "message.received",
              title: `New message · ${project.name}`,
              body: input.body.length > 120 ? `${input.body.slice(0, 117)}...` : input.body,
              metaJson: { projectId: project.id, conversationId: id },
            }),
          ),
      );
    }

    return reply.status(201).send({ data: message });
  });

  app.post("/conversations/:id/read", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const { project } = await loadConversationAndProject(id);
    const authUser = requireAuth(request);
    await requireOrgPermission(request, project.organizationId, "projects.view");

    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: id, userId: authUser.id } },
      create: { conversationId: id, userId: authUser.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return reply.send({ message: "Marked as read" });
  });
}
