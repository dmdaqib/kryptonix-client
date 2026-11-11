import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireAuth } from "../../plugins/auth.ts";
import { requireOrgPermission } from "../../plugins/rbac.ts";
import { ForbiddenError, NotFoundError } from "../../plugins/error-handler.ts";

/**
 * Registers metadata for a file whose bytes were already uploaded directly
 * to object storage via a presigned URL. There is no real storage provider
 * wired up in this sandbox (no outbound network to S3/GCS, same constraint
 * documented in docs/PAYMENTS.md for the payments module) — storageKey is
 * client-supplied and treated as an opaque pointer. A production
 * deployment would add a `POST /files/presign` route backed by a
 * `StorageProvider` interface (mirroring PaymentProvider in
 * modules/payments/provider.ts) before this route is safe to expose
 * publicly; see PROGRESS.md.
 */
const RegisterFileSchema = z.object({
  category: z.string().min(1),
  originalName: z.string().min(1),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  visibility: z.enum(["CLIENT_VISIBLE", "INTERNAL_ONLY"]).default("CLIENT_VISIBLE"),
});

export async function fileRoutes(app: FastifyInstance) {
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
