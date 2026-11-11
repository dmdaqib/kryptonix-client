import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { verifyJwt, JwtError, type JwtPayload } from "@kryptonix/shared";
import { env } from "../config.ts";
import { UnauthorizedError } from "./error-handler.ts";
import { prisma } from "../db/prisma.ts";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      id: string;
      userType: "CLIENT" | "STAFF";
      staffRole: string | null;
      sessionId: string;
    };
  }
}

async function resolveAuthUser(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return;

  const token = header.slice("Bearer ".length);
  let payload: JwtPayload;
  try {
    payload = verifyJwt(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err instanceof JwtError) return; // leave authUser unset -> requireAuth will 401
    throw err;
  }

  // Confirm the session is still valid (not revoked/logged out) on every
  // request — a stolen but-not-yet-expired access token stops working the
  // moment the session is revoked server-side.
  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt) return;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === "SUSPENDED" || user.status === "DEACTIVATED") return;

  request.authUser = {
    id: user.id,
    userType: user.userType,
    staffRole: user.staffRole,
    sessionId: session.id,
  };
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("authUser", undefined);
  app.addHook("preHandler", resolveAuthUser);
});

/** Route-level guard: 401s unless resolveAuthUser attached a user above. */
export function requireAuth(request: FastifyRequest) {
  if (!request.authUser) throw new UnauthorizedError();
  return request.authUser;
}
