import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireStaffPermission } from "../../plugins/rbac.ts";
import { NotFoundError } from "../../plugins/error-handler.ts";

const PackageInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  priceAmount: z.number().nonnegative(),
  currency: z.string().default("INR"),
  taxPercent: z.number().min(0).max(100).default(0),
  expectedDurationDays: z.number().int().positive().optional(),
  paymentTerms: z.string().optional(),
  termsAndConditions: z.string().optional(),
  features: z.array(z.object({ label: z.string(), included: z.boolean().default(true) })).default([]),
});

const ServiceInputSchema = z.object({
  categoryId: z.string().cuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().min(1),
});

// Public: every screen under "Service Discovery" reads from here. No
// prices, packages or copy are invented client-side — everything comes
// from what staff publish through the write endpoints below.
export async function catalogueRoutes(app: FastifyInstance) {
  app.get("/catalogue/categories", async (_request, reply) => {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return reply.send({ data: categories });
  });

  app.get("/catalogue/services", async (request, reply) => {
    const { categoryId, categorySlug, search } = z
      .object({
        categoryId: z.string().optional(),
        categorySlug: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(request.query);

    const where: Record<string, unknown> = { isActive: true };
    if (categoryId) {
      where.categoryId = categoryId;
    } else if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const services = await prisma.service.findMany({
      where,
      include: {
        category: true,
        // Include available packages with duration and features so mobile cards can show full details
        packages: {
          where: { isAvailable: true },
          orderBy: { priceAmount: "asc" },
          select: {
            id: true,
            name: true,
            description: true,
            priceAmount: true,
            currency: true,
            expectedDurationDays: true,
            features: {
              where: { included: true },
              take: 4,
              select: { label: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({ data: services });
  });

  app.get("/catalogue/services/:slug", async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const service = await prisma.service.findUnique({
      where: { slug },
      include: {
        category: true,
        packages: { where: { isAvailable: true }, include: { features: true } },
      },
    });
    if (!service) throw new NotFoundError("Service not found");
    return reply.send({ data: service });
  });

  // Staff: catalogue management (Sales Manager / Admin / Super Admin).
  app.post("/catalogue/services", async (request, reply) => {
    requireStaffPermission(request, "staff.manage_catalogue");
    const input = ServiceInputSchema.parse(request.body);
    const service = await prisma.service.create({ data: input });
    return reply.status(201).send({ data: service });
  });

  app.post("/catalogue/services/:id/packages", async (request, reply) => {
    requireStaffPermission(request, "staff.manage_catalogue");
    const { id: serviceId } = z.object({ id: z.string().cuid() }).parse(request.params);
    const input = PackageInputSchema.parse(request.body);

    const pkg = await prisma.servicePackage.create({
      data: {
        serviceId,
        name: input.name,
        description: input.description,
        priceAmount: input.priceAmount,
        currency: input.currency,
        taxPercent: input.taxPercent,
        expectedDurationDays: input.expectedDurationDays,
        paymentTerms: input.paymentTerms,
        termsAndConditions: input.termsAndConditions,
        features: { create: input.features },
      },
      include: { features: true },
    });
    return reply.status(201).send({ data: pkg });
  });
}
