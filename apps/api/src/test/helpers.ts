import { randomUUID } from "node:crypto";
import { hashPassword, signJwt, type StaffRole } from "@kryptonix/shared";
import { prisma } from "../db/prisma.ts";
import { env } from "../config.ts";

/**
 * Test-only helpers for minting fully-authenticated users without going
 * through the HTTP registration/login flow — that flow has its own
 * responsibility (and should get its own tests separately); these
 * integration tests are about proving the P3/P5 route handlers work
 * end-to-end against a real database, which is what CI's postgres
 * service exists for.
 */

export interface AuthedUser {
  id: string;
  token: string;
}

async function mintSessionAndToken(userId: string, role: "CLIENT" | "STAFF"): Promise<string> {
  const session = await prisma.session.create({ data: { userId } });
  return signJwt({ sub: userId, sid: session.id, role }, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_TTL_SECONDS);
}

export async function createStaffUser(staffRole: StaffRole): Promise<AuthedUser> {
  const passwordHash = await hashPassword("Test1234!integration");
  const user = await prisma.user.create({
    data: {
      email: `staff-${randomUUID()}@kryptonix.test`,
      passwordHash,
      fullName: `Test ${staffRole}`,
      userType: "STAFF",
      staffRole,
      status: "ACTIVE",
    },
  });
  const token = await mintSessionAndToken(user.id, "STAFF");
  return { id: user.id, token };
}

export interface ClientOwner extends AuthedUser {
  organizationId: string;
}

export async function createClientOrgOwner(): Promise<ClientOwner> {
  const passwordHash = await hashPassword("Test1234!integration");
  const user = await prisma.user.create({
    data: {
      email: `client-${randomUUID()}@kryptonix.test`,
      passwordHash,
      fullName: "Test Client Owner",
      userType: "CLIENT",
      status: "ACTIVE",
    },
  });
  const organization = await prisma.organization.create({
    data: { name: `Test Org ${randomUUID()}` },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
  });
  const token = await mintSessionAndToken(user.id, "CLIENT");
  return { id: user.id, token, organizationId: organization.id };
}

export function authHeader(user: AuthedUser): Record<string, string> {
  return { authorization: `Bearer ${user.token}` };
}
