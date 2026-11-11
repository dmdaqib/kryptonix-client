import type { Prisma } from "@prisma/client";
import type { StaffRole } from "@kryptonix/shared";
import { prisma } from "../db/prisma.ts";

/**
 * Every in-app notification funnels through here. The Notification row is
 * always written — that's the durable record a user sees in the app and
 * what GET /notifications reads back — regardless of whether a push/email
 * provider is wired up.
 *
 * Real push (Expo push via DeviceToken) and email dispatch are explicitly
 * NOT implemented in this sandbox: there's no outbound network to a push
 * gateway or an SMTP/email-API provider here, and no real device tokens to
 * send to. NotificationPreference (push/email toggles) and DeviceToken
 * (registered tokens) are modeled and have working CRUD routes
 * (notifications.routes.ts) specifically so that dispatcher is a single,
 * well-defined piece to add later — it reads rows this module already
 * writes and already lets users opt out of. See PROGRESS.md.
 */

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  metaJson?: Record<string, unknown>;
}

export async function notifyUser(input: NotifyInput) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      channel: "IN_APP",
      metaJson: input.metaJson as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Fans a notification out to every member of a client organization. */
export async function notifyOrganization(
  organizationId: string,
  input: Omit<NotifyInput, "userId">,
  opts: { excludeUserId?: string } = {},
) {
  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId,
      ...(opts.excludeUserId ? { userId: { not: opts.excludeUserId } } : {}),
    },
    select: { userId: true },
  });
  await Promise.all(members.map((m) => notifyUser({ ...input, userId: m.userId })));
}

/** Fans a notification out to every staff user holding a given staff role. */
export async function notifyStaffRole(role: StaffRole, input: Omit<NotifyInput, "userId">) {
  const staff = await prisma.user.findMany({
    where: { userType: "STAFF", staffRole: role },
    select: { id: true },
  });
  await Promise.all(staff.map((s) => notifyUser({ ...input, userId: s.id })));
}

/** Notifies every member of a project (staff assigned to it, via ProjectMember), optionally excluding the actor. */
export async function notifyProjectStaff(
  projectId: string,
  input: Omit<NotifyInput, "userId">,
  opts: { excludeUserId?: string } = {},
) {
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      ...(opts.excludeUserId ? { userId: { not: opts.excludeUserId } } : {}),
    },
    select: { userId: true },
  });
  await Promise.all(members.map((m) => notifyUser({ ...input, userId: m.userId })));
}
