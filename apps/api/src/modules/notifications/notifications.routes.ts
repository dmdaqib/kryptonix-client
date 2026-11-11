import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.ts";
import { requireAuth } from "../../plugins/auth.ts";
import { NotFoundError } from "../../plugins/error-handler.ts";

const ListQuerySchema = z.object({
  take: z.coerce.number().int().positive().max(100).default(30),
  unreadOnly: z.coerce.boolean().default(false),
});

const RegisterDeviceTokenSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

const UpdatePreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  paymentAlertsEnabled: z.boolean().optional(),
  projectAlertsEnabled: z.boolean().optional(),
  messageAlertsEnabled: z.boolean().optional(),
  hideContentInPreview: z.boolean().optional(),
});

export async function notificationRoutes(app: FastifyInstance) {
  // Every user — client or staff — reads only their own notifications, so
  // these routes need no org/staff permission check beyond being logged in.
  app.get("/notifications", async (request, reply) => {
    const authUser = requireAuth(request);
    const { take, unreadOnly } = ListQuerySchema.parse(request.query);

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: authUser.id, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.notification.count({ where: { userId: authUser.id, readAt: null } }),
    ]);

    return reply.send({ data: notifications, meta: { unreadCount } });
  });

  app.post("/notifications/:id/read", async (request, reply) => {
    const authUser = requireAuth(request);
    const { id } = z.object({ id: z.string().cuid() }).parse(request.params);

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== authUser.id) {
      // Same shape for "doesn't exist" and "not yours" — never confirm a
      // notification id belongs to someone else.
      throw new NotFoundError("Notification not found");
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    return reply.send({ data: updated });
  });

  app.post("/notifications/read-all", async (request, reply) => {
    const authUser = requireAuth(request);
    await prisma.notification.updateMany({
      where: { userId: authUser.id, readAt: null },
      data: { readAt: new Date() },
    });
    return reply.send({ message: "All notifications marked as read" });
  });

  // Expo push token registration. Upserted by token, not by user, since
  // the same physical device/token should only ever map to one row even if
  // it's re-registered after a token refresh or a re-login.
  app.post("/notifications/device-tokens", async (request, reply) => {
    const authUser = requireAuth(request);
    const input = RegisterDeviceTokenSchema.parse(request.body);

    const token = await prisma.deviceToken.upsert({
      where: { expoPushToken: input.expoPushToken },
      create: { userId: authUser.id, expoPushToken: input.expoPushToken, platform: input.platform },
      update: { userId: authUser.id, platform: input.platform },
    });
    return reply.status(201).send({ data: token });
  });

  app.delete("/notifications/device-tokens/:token", async (request, reply) => {
    const authUser = requireAuth(request);
    const { token } = z.object({ token: z.string().min(1) }).parse(request.params);

    const existing = await prisma.deviceToken.findUnique({ where: { expoPushToken: token } });
    if (existing && existing.userId === authUser.id) {
      await prisma.deviceToken.delete({ where: { expoPushToken: token } });
    }
    return reply.send({ message: "Device token removed" });
  });

  app.get("/notifications/preferences", async (request, reply) => {
    const authUser = requireAuth(request);
    const prefs =
      (await prisma.notificationPreference.findUnique({ where: { userId: authUser.id } })) ??
      (await prisma.notificationPreference.create({ data: { userId: authUser.id } }));
    return reply.send({ data: prefs });
  });

  app.patch("/notifications/preferences", async (request, reply) => {
    const authUser = requireAuth(request);
    const input = UpdatePreferencesSchema.parse(request.body);

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: authUser.id },
      create: { userId: authUser.id, ...input },
      update: input,
    });
    return reply.send({ data: prefs });
  });
}
