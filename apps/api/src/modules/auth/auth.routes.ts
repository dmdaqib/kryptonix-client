import type { FastifyInstance } from "fastify";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  RefreshTokenSchema,
} from "@kryptonix/shared";
import * as authService from "./auth.service.ts";
import { requireAuth } from "../../plugins/auth.ts";
import { prisma } from "../../db/prisma.ts";

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/register",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const input = RegisterSchema.parse(request.body);
      const result = await authService.registerClient(input, request.ip);
      return reply.status(201).send({
        data: result,
        message: "Account created. Check your email to verify your address.",
      });
    },
  );

  app.post("/verify-email", async (request, reply) => {
    const { token } = VerifyEmailSchema.parse(request.body);
    await authService.verifyEmail(token);
    return reply.send({ message: "Email verified. Your account is pending KryptonIX approval." });
  });

  app.post(
    "/login",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const { email, password } = LoginSchema.parse(request.body);
      const { user, tokens } = await authService.login(email, password, {
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
      });
      return reply.send({
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            userType: user.userType,
            status: user.status,
          },
          ...tokens,
        },
      });
    },
  );

  app.post("/refresh", async (request, reply) => {
    const { refreshToken } = RefreshTokenSchema.parse(request.body);
    const tokens = await authService.refreshSession(refreshToken);
    return reply.send({ data: tokens });
  });

  app.post("/logout", async (request, reply) => {
    const authUser = requireAuth(request);
    await authService.logout(authUser.sessionId);
    return reply.send({ message: "Logged out" });
  });

  app.post(
    "/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const { email } = ForgotPasswordSchema.parse(request.body);
      await authService.requestPasswordReset(email);
      // Same response whether or not the email exists (see service layer).
      return reply.send({ message: "If that account exists, a reset link has been sent." });
    },
  );

  app.post("/reset-password", async (request, reply) => {
    const { token, newPassword } = ResetPasswordSchema.parse(request.body);
    await authService.resetPassword(token, newPassword);
    return reply.send({ message: "Password updated. Please sign in again." });
  });

  app.get("/me", async (request, reply) => {
    const authUser = requireAuth(request);
    const user = await authService.getOrThrowUser(authUser.id);
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: authUser.id },
      include: { organization: true },
    });
    return reply.send({
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        staffRole: user.staffRole,
        status: user.status,
        organizations: memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
          approved: Boolean(m.organization.approvedAt),
        })),
      },
    });
  });
}
