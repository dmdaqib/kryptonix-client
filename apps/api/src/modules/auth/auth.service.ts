import { prisma } from "../../db/prisma.ts";
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  addDuration,
  DURATIONS,
  signJwt,
  type RegisterInput,
} from "@kryptonix/shared";
import { env } from "../../config.ts";
import { ConflictError, UnauthorizedError, NotFoundError } from "../../plugins/error-handler.ts";
import { sendEmail, verificationEmail, passwordResetEmail } from "../../services/email.ts";
import { recordAudit } from "../../plugins/audit.ts";
import { randomUUID } from "node:crypto";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const failedLoginAttempts = new Map<string, { count: number; lockedUntil?: number }>();

function checkLoginThrottle(email: string) {
  const entry = failedLoginAttempts.get(email);
  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    throw new UnauthorizedError("Too many failed attempts. Try again later.");
  }
}

function recordFailedLogin(email: string) {
  const entry = failedLoginAttempts.get(email) ?? { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILED_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + 15 * 60 * 1000;
  }
  failedLoginAttempts.set(email, entry);
}

function clearFailedLogins(email: string) {
  failedLoginAttempts.delete(email);
}

export async function registerClient(input: RegisterInput, ipAddress?: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("An account with this email already exists");

  const passwordHash = await hashPassword(input.password);

  const { user, organization } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.businessName,
        businessCategory: input.businessCategory,
        website: input.businessWebsite || undefined,
        country: input.country,
        // Public registrations require KryptonIX approval before the
        // organization's data is usable — approvedAt stays null until a
        // staff admin approves it.
      },
    });

    const user = await tx.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash,
        fullName: input.fullName,
        userType: "CLIENT",
        // Email verification is skipped for now (no real email provider is
        // wired up yet — see apps/api/src/services/email.ts). Accounts go
        // straight to PENDING_APPROVAL, which already allows sign-in while
        // showing the client a "pending KryptonIX approval" state. Re-enable
        // PENDING_EMAIL_VERIFICATION + issueEmailVerification(...) below once
        // a real EMAIL_PROVIDER is configured.
        status: "PENDING_APPROVAL",
        emailVerifiedAt: new Date(),
      },
    });

    await tx.organizationMember.create({
      data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });

    return { user, organization };
  });

  await recordAudit({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "user.registered",
    entityType: "User",
    entityId: user.id,
    ipAddress,
  });

  return { userId: user.id, organizationId: organization.id };
}

export async function issueEmailVerification(userId: string, email: string) {
  const token = generateSecureToken();
  await prisma.emailVerification.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: addDuration(new Date(), DURATIONS.EMAIL_VERIFICATION_MS),
    },
  });
  const link = `${env.CLIENT_WEB_URL}/verify-email?token=${token}`;
  await sendEmail({ to: email, ...verificationEmail(link) });
}

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired verification token");
  }

  await prisma.$transaction([
    prisma.emailVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: new Date(),
        // Staff accounts created via invitation skip the public-approval
        // queue; client accounts move to PENDING_APPROVAL until staff
        // approves the organization.
        status: "PENDING_APPROVAL",
      },
    }),
  ]);
}

export async function login(
  email: string,
  password: string,
  context: { userAgent?: string; ipAddress?: string },
) {
  checkLoginThrottle(email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    recordFailedLogin(email);
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    recordFailedLogin(email);
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status === "PENDING_EMAIL_VERIFICATION") {
    throw new UnauthorizedError("Please verify your email before signing in");
  }
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw new UnauthorizedError("This account is no longer active");
  }
  // PENDING_APPROVAL users CAN sign in — the mobile app shows a "pending
  // approval" screen for them (see apps/mobile), but we don't block the
  // session, since they still need to see that state.

  clearFailedLogins(email);

  const session = await prisma.session.create({
    data: { userId: user.id, userAgent: context.userAgent, ipAddress: context.ipAddress },
  });

  const tokens = await issueTokenPair(user.id, session.id, user.userType);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return { user, tokens };
}

async function issueTokenPair(userId: string, sessionId: string, userType: string) {
  const accessToken = signJwt(
    { sub: userId, sid: sessionId, role: userType },
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_TTL_SECONDS,
  );

  const refreshTokenRaw = generateSecureToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      sessionId,
      tokenHash: hashToken(refreshTokenRaw),
      expiresAt: addDuration(new Date(), DURATIONS.REFRESH_TOKEN_MS),
    },
  });

  return { accessToken, refreshToken: refreshTokenRaw };
}

/**
 * Refresh-token rotation: every use issues a brand-new refresh token and
 * marks the old one as replaced. If a token that was already replaced is
 * ever presented again (a sign of theft/replay), the entire session is
 * revoked immediately rather than just rejecting the one request.
 */
export async function refreshSession(refreshTokenRaw: string) {
  const tokenHash = hashToken(refreshTokenRaw);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing) throw new UnauthorizedError("Invalid refresh token");

  if (existing.revokedAt || existing.replacedById) {
    // Reuse of a rotated-out token: assume compromise, kill the session.
    await prisma.session.update({
      where: { id: existing.sessionId },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError("Refresh token reuse detected; session revoked");
  }

  if (existing.expiresAt < new Date()) throw new UnauthorizedError("Refresh token expired");

  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user) throw new UnauthorizedError("Invalid refresh token");

  const newRaw = generateSecureToken();
  const newToken = await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      sessionId: existing.sessionId,
      tokenHash: hashToken(newRaw),
      expiresAt: addDuration(new Date(), DURATIONS.REFRESH_TOKEN_MS),
    },
  });

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedById: newToken.id },
  });

  const accessToken = signJwt(
    { sub: user.id, sid: existing.sessionId, role: user.userType },
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_TTL_SECONDS,
  );

  return { accessToken, refreshToken: newRaw };
}

export async function logout(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always behave the same whether or not the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  if (!user) return;

  const token = generateSecureToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: addDuration(new Date(), DURATIONS.PASSWORD_RESET_MS),
    },
  });
  const link = `${env.CLIENT_WEB_URL}/reset-password?token=${token}`;
  await sendEmail({ to: user.email, ...passwordResetEmail(link) });
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Changing the password revokes every existing session — a leaked
    // password shouldn't leave old sessions usable after reset.
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function getOrThrowUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export { randomUUID };
