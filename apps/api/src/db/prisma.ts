import { PrismaClient } from "@prisma/client";
import { env } from "../config.ts";

// Single Prisma client instance per process. In dev with hot-reload this is
// cached on `globalThis` so repeated reloads don't exhaust the Postgres
// connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
