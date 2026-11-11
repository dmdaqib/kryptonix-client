import type { FastifyRequest } from "fastify";
import {
  clientHasPermission,
  staffHasPermission,
  type Permission,
  type ClientRole,
} from "@kryptonix/shared";
import { prisma } from "../db/prisma.ts";
import { ForbiddenError, UnauthorizedError } from "./error-handler.ts";
import { requireAuth } from "./auth.ts";

/**
 * Enforces organization-scoped permissions for CLIENT users, or global
 * staff permissions for STAFF users. This is the ONLY place authorization
 * decisions are made — never infer access from what a screen merely shows.
 */
export async function requireOrgPermission(
  request: FastifyRequest,
  organizationId: string,
  permission: Permission,
): Promise<{ userId: string; clientRole?: ClientRole }> {
  const authUser = requireAuth(request);

  if (authUser.userType === "STAFF") {
    if (!authUser.staffRole || !staffHasPermission(authUser.staffRole as never, permission)) {
      throw new ForbiddenError(`Missing staff permission: ${permission}`);
    }
    return { userId: authUser.id };
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: authUser.id } },
  });

  if (!membership) {
    // Returning 404-shaped Forbidden avoids confirming the org id is valid
    // to a user who isn't a member of it.
    throw new ForbiddenError("Not a member of this organization");
  }

  if (!clientHasPermission(membership.role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }

  return { userId: authUser.id, clientRole: membership.role };
}

export function requireStaffPermission(request: FastifyRequest, permission: Permission) {
  const authUser = requireAuth(request);
  if (authUser.userType !== "STAFF") throw new ForbiddenError("Staff only");
  if (!authUser.staffRole || !staffHasPermission(authUser.staffRole as never, permission)) {
    throw new ForbiddenError(`Missing staff permission: ${permission}`);
  }
  return authUser;
}

export function requireStaff(request: FastifyRequest) {
  const authUser = requireAuth(request);
  if (authUser.userType !== "STAFF") throw new UnauthorizedError("Staff only");
  return authUser;
}
