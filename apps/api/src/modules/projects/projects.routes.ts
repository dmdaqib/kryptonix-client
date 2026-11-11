import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireOrgPermission, requireStaffPermission } from "../../plugins/rbac.ts";
import { NotFoundError } from "../../plugins/error-handler.ts";
import { recordAudit } from "../../plugins/audit.ts";
import { notifyOrganization, notifyProjectStaff } from "../../plugins/notify.ts";

const ProjectStatusValues = [
  "NOT_STARTED",
  "PLANNING",
  "IN_PROGRESS",
  "UNDER_CLIENT_REVIEW",
  "REVISION_REQUIRED",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

const MilestoneStatusValues = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED_FOR_REVIEW",
  "APPROVED",
  "REVISION_REQUESTED",
  "COMPLETED",
] as const;

const CreateProjectSchema = z.object({
  organizationId: z.string().cuid(),
  quoteId: z.string().cuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  serviceCategory: z.string().optional(),
  startDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().optional(),
  // Client-side users (the organization's own staff who will use the app)
  // to grant project visibility to from day one; staff assigned to build
  // it are added separately via POST /projects/:id/members.
  clientMemberUserIds: z.array(z.string().cuid()).default([]),
});

const UpdateProjectStatusSchema = z.object({ status: z.enum(ProjectStatusValues) });

const AddProjectMemberSchema = z.object({
  userId: z.string().cuid(),
  isManager: z.boolean().default(false),
});

const CreateMilestoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  requiresClientApproval: z.boolean().default(true),
});

const UpdateMilestoneStatusSchema = z.object({ status: z.enum(MilestoneStatusValues) });

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  milestoneId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().optional(),
  dueDate: z.coerce.date().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

const SubmitDeliverableSchema = z.object({ fileId: z.string().cuid() });
const RequestRevisionSchema = z.object({ notes: z.string().min(3) });

async function loadProjectOrThrow(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

async function recordActivity(
  projectId: string,
  actorId: string | null,
  action: string,
  metaJson?: Record<string, unknown>,
) {
  await prisma.projectActivity.create({
    data: { projectId, actorId, action, metaJson: metaJson as Prisma.InputJsonValue | undefined },
  });
}

export async function projectRoutes(app: FastifyInstance) {
  // Staff: create a project, typically right after a quote is accepted.
  app.post("/projects", async (request, reply) => {
    const staff = requireStaffPermission(request, "projects.manage");
    const input = CreateProjectSchema.parse(request.body);

    const project = await prisma.project.create({
      data: {
        organizationId: input.organizationId,
        quoteId: input.quoteId,
        name: input.name,
        description: input.description,
        serviceCategory: input.serviceCategory,
        startDate: input.startDate,
        expectedDeliveryDate: input.expectedDeliveryDate,
        status: "NOT_STARTED",
        members: {
          create: input.clientMemberUserIds.map((userId) => ({ userId })),
        },
      },
    });

    await recordActivity(project.id, staff.id, "project.created");
    await recordAudit({
      organizationId: input.organizationId,
      actorUserId: staff.id,
      action: "project.created",
      entityType: "Project",
      entityId: project.id,
    });
    await notifyOrganization(input.organizationId, {
      type: "project.created",
      title: "A new project was started",
      body: project.name,
      metaJson: { projectId: project.id },
    });

    return reply.status(201).send({ data: project });
  });

  app.get("/organizations/:organizationId/projects", async (request, reply) => {
    const { organizationId } = z.object({ organizationId: z.string().cuid() }).parse(request.params);
    await requireOrgPermission(request, organizationId, "projects.view");

    const projects = await prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: projects });
  });

  app.get("/projects/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const project = await loadProjectOrThrow(id);
    await requireOrgPermission(request, project.organizationId, "projects.view");

    const [milestones, tasks, members, updates, activity] = await Promise.all([
      prisma.milestone.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" },
        include: { deliverables: { orderBy: { version: "desc" }, include: { approvals: true, file: true } } },
      }),
      prisma.projectTask.findMany({ where: { projectId: id }, orderBy: { createdAt: "asc" } }),
      prisma.projectMember.findMany({ where: { projectId: id }, include: { user: { select: { id: true, fullName: true, userType: true } } } }),
      prisma.projectUpdate.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.projectActivity.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);

    return reply.send({ data: { ...project, milestones, tasks, members, updates, activity } });
  });

  app.patch("/projects/:id/status", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "projects.manage");
    const { status } = UpdateProjectStatusSchema.parse(request.body);

    const project = await loadProjectOrThrow(id);
    const updated = await prisma.project.update({
      where: { id },
      data: { status, completedAt: status === "COMPLETED" ? new Date() : project.completedAt },
    });

    await recordActivity(id, staff.id, "project.status_changed", { from: project.status, to: status });
    await recordAudit({
      organizationId: project.organizationId,
      actorUserId: staff.id,
      action: "project.status_changed",
      entityType: "Project",
      entityId: id,
      metaJson: { from: project.status, to: status },
    });

    if (status === "UNDER_CLIENT_REVIEW" || status === "COMPLETED") {
      await notifyOrganization(project.organizationId, {
        type: "project.status_changed",
        title: status === "COMPLETED" ? "Project completed" : "Your project is ready for review",
        body: project.name,
        metaJson: { projectId: id, status },
      });
    }

    return reply.send({ data: updated });
  });

  app.post("/projects/:id/members", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "projects.manage");
    const input = AddProjectMemberSchema.parse(request.body);
    const project = await loadProjectOrThrow(id);

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: input.userId } },
      create: { projectId: id, userId: input.userId, isManager: input.isManager },
      update: { isManager: input.isManager },
    });

    await recordActivity(id, staff.id, "project.member_added", { userId: input.userId });
    await recordAudit({
      organizationId: project.organizationId,
      actorUserId: staff.id,
      action: "project.member_added",
      entityType: "Project",
      entityId: id,
      metaJson: { userId: input.userId },
    });

    return reply.status(201).send({ data: member });
  });

  app.post("/projects/:id/updates", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "projects.manage");
    const { body } = z.object({ body: z.string().min(1) }).parse(request.body);
    const project = await loadProjectOrThrow(id);

    const update = await prisma.projectUpdate.create({ data: { projectId: id, authorId: staff.id, body } });
    await recordActivity(id, staff.id, "project.update_posted");
    await notifyOrganization(project.organizationId, {
      type: "project.update",
      title: `Update on ${project.name}`,
      body,
      metaJson: { projectId: id },
    });

    return reply.status(201).send({ data: update });
  });

  // ── Milestones ───────────────────────────────────────────────────────

  app.post("/projects/:id/milestones", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "projects.manage");
    const input = CreateMilestoneSchema.parse(request.body);
    await loadProjectOrThrow(id);

    const milestone = await prisma.milestone.create({
      data: { projectId: id, ...input, status: "NOT_STARTED" },
    });
    await recordActivity(id, staff.id, "milestone.created", { milestoneId: milestone.id });

    return reply.status(201).send({ data: milestone });
  });

  app.patch("/milestones/:id/status", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "projects.manage");
    const { status } = UpdateMilestoneStatusSchema.parse(request.body);

    const milestone = await prisma.milestone.findUnique({ where: { id } });
    if (!milestone) throw new NotFoundError("Milestone not found");

    const updated = await prisma.milestone.update({ where: { id }, data: { status } });
    await recordActivity(milestone.projectId, staff.id, "milestone.status_changed", {
      milestoneId: id,
      from: milestone.status,
      to: status,
    });

    return reply.send({ data: updated });
  });

  // ── Tasks ────────────────────────────────────────────────────────────

  app.post("/projects/:id/tasks", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    requireStaffPermission(request, "projects.manage");
    const input = CreateTaskSchema.parse(request.body);
    await loadProjectOrThrow(id);

    const task = await prisma.projectTask.create({
      data: { projectId: id, title: input.title, milestoneId: input.milestoneId, assigneeId: input.assigneeId, dueDate: input.dueDate },
    });
    return reply.status(201).send({ data: task });
  });

  app.patch("/tasks/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    requireStaffPermission(request, "projects.manage");
    const input = UpdateTaskSchema.parse(request.body);

    const task = await prisma.projectTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundError("Task not found");

    const updated = await prisma.projectTask.update({ where: { id }, data: input });
    return reply.send({ data: updated });
  });

  // ── Deliverables & approvals ─────────────────────────────────────────

  // Staff submits a deliverable (an already-registered File — see
  // files.routes.ts) against a milestone for client review.
  app.post("/milestones/:id/deliverables", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const staff = requireStaffPermission(request, "projects.manage");
    const input = SubmitDeliverableSchema.parse(request.body);

    const milestone = await prisma.milestone.findUnique({ where: { id } });
    if (!milestone) throw new NotFoundError("Milestone not found");
    const project = await loadProjectOrThrow(milestone.projectId);

    const file = await prisma.file.findUnique({ where: { id: input.fileId } });
    if (!file) throw new NotFoundError("File not found");

    const lastVersion = await prisma.deliverable.findFirst({
      where: { milestoneId: id },
      orderBy: { version: "desc" },
    });

    const [deliverable] = await prisma.$transaction([
      prisma.deliverable.create({
        data: {
          milestoneId: id,
          fileId: input.fileId,
          version: (lastVersion?.version ?? 0) + 1,
          submittedByUserId: staff.id,
        },
      }),
      prisma.milestone.update({
        where: { id },
        data: { status: milestone.requiresClientApproval ? "SUBMITTED_FOR_REVIEW" : "COMPLETED" },
      }),
    ]);

    await recordActivity(milestone.projectId, staff.id, "deliverable.submitted", {
      milestoneId: id,
      deliverableId: deliverable.id,
    });

    if (milestone.requiresClientApproval) {
      await notifyOrganization(project.organizationId, {
        type: "deliverable.submitted",
        title: `${milestone.name} is ready for your review`,
        body: project.name,
        metaJson: { projectId: project.id, milestoneId: id, deliverableId: deliverable.id },
      });
    }

    return reply.status(201).send({ data: deliverable });
  });

  app.post("/deliverables/:id/approve", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const deliverable = await prisma.deliverable.findUnique({
      where: { id },
      include: { milestone: true },
    });
    if (!deliverable) throw new NotFoundError("Deliverable not found");

    const project = await loadProjectOrThrow(deliverable.milestone.projectId);
    const actor = await requireOrgPermission(request, project.organizationId, "deliverables.approve");

    const [approval] = await prisma.$transaction([
      prisma.approval.create({
        data: { deliverableId: id, decidedByUserId: actor.userId, decision: "APPROVED" },
      }),
      prisma.milestone.update({ where: { id: deliverable.milestoneId }, data: { status: "APPROVED" } }),
    ]);

    await recordActivity(project.id, actor.userId, "deliverable.approved", { deliverableId: id });
    await recordAudit({
      organizationId: project.organizationId,
      actorUserId: actor.userId,
      action: "deliverable.approved",
      entityType: "Deliverable",
      entityId: id,
    });
    await notifyProjectStaff(project.id, {
      type: "deliverable.approved",
      title: `${deliverable.milestone.name} was approved`,
      body: project.name,
      metaJson: { projectId: project.id, deliverableId: id },
    });

    return reply.status(201).send({ data: approval });
  });

  app.post("/deliverables/:id/request-revision", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const input = RequestRevisionSchema.parse(request.body);

    const deliverable = await prisma.deliverable.findUnique({
      where: { id },
      include: { milestone: true },
    });
    if (!deliverable) throw new NotFoundError("Deliverable not found");

    const project = await loadProjectOrThrow(deliverable.milestone.projectId);
    const actor = await requireOrgPermission(request, project.organizationId, "deliverables.approve");

    const approval = await prisma.approval.create({
      data: {
        deliverableId: id,
        decidedByUserId: actor.userId,
        decision: "REVISION_REQUESTED",
        feedback: input.notes,
        revisionRequests: { create: { notes: input.notes } },
      },
    });
    await prisma.milestone.update({ where: { id: deliverable.milestoneId }, data: { status: "REVISION_REQUESTED" } });

    await recordActivity(project.id, actor.userId, "deliverable.revision_requested", { deliverableId: id });
    await recordAudit({
      organizationId: project.organizationId,
      actorUserId: actor.userId,
      action: "deliverable.revision_requested",
      entityType: "Deliverable",
      entityId: id,
      metaJson: { notes: input.notes },
    });
    await notifyProjectStaff(project.id, {
      type: "deliverable.revision_requested",
      title: `Revision requested: ${deliverable.milestone.name}`,
      body: input.notes,
      metaJson: { projectId: project.id, deliverableId: id },
    });

    return reply.status(201).send({ data: approval });
  });
}
