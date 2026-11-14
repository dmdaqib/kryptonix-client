import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireAuth } from "../../plugins/auth.ts";
import { requireOrgPermission } from "../../plugins/rbac.ts";
import { ForbiddenError, NotFoundError } from "../../plugins/error-handler.ts";
import { getStorageProvider } from "../../services/storage.ts";

const PresignUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
});

const RegisterFileSchema = z.object({
  category: z.string().min(1),
  originalName: z.string().min(1),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  visibility: z.enum(["CLIENT_VISIBLE", "INTERNAL_ONLY"]).default("CLIENT_VISIBLE"),
});

export async function fileRoutes(app: FastifyInstance) {
  app.post("/projects/:id/files/presign", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundError("Project not found");

    requireAuth(request);
    await requireOrgPermission(request, project.organizationId, "projects.view");
    const input = PresignUploadSchema.parse(request.body);

    const storage = getStorageProvider();
    const presigned = await storage.createPresignedUploadUrl({
      organizationId: project.organizationId,
      projectId: id,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    return reply.status(200).send({ data: presigned });
  });

  app.get("/projects/:id/files/:fileId/download", async (request, reply) => {
    const { id, fileId } = z
      .object({ id: z.string().cuid(), fileId: z.string().cuid() })
      .parse(request.params);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundError("Project not found");

    const authUser = requireAuth(request);
    await requireOrgPermission(request, project.organizationId, "projects.view");

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.projectId !== id) throw new NotFoundError("File not found");

    if (file.visibility === "INTERNAL_ONLY" && authUser.userType !== "STAFF") {
      throw new ForbiddenError("File is restricted to staff");
    }

    const storage = getStorageProvider();
    const download = await storage.createPresignedDownloadUrl(file.storageKey);
    return reply.status(200).send({ data: { ...download, file } });
  });
  app.post("/projects/:id/files", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundError("Project not found");

    const authUser = requireAuth(request);
    await requireOrgPermission(request, project.organizationId, "projects.view");
    const input = RegisterFileSchema.parse(request.body);

    if (input.visibility === "INTERNAL_ONLY" && authUser.userType !== "STAFF") {
      throw new ForbiddenError("Only staff can mark a file internal-only");
    }

    const file = await prisma.file.create({
      data: {
        organizationId: project.organizationId,
        projectId: id,
        uploadedByUserId: authUser.id,
        category: input.category,
        originalName: input.originalName,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        visibility: input.visibility,
      },
    });

    return reply.status(201).send({ data: file });
  });

  app.get("/projects/:id/files", async (request, reply) => {
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundError("Project not found");

    const authUser = requireAuth(request);
    await requireOrgPermission(request, project.organizationId, "projects.view");

    const files = await prisma.file.findMany({
      where: {
        projectId: id,
        ...(authUser.userType === "STAFF" ? {} : { visibility: "CLIENT_VISIBLE" }),
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: files });
  });
}
