import { PrismaClient } from "./generated/client/index.js";

export * from "./generated/client/index.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * A single PrismaClient per process. Next.js dev mode re-evaluates modules on
 * every hot reload, which would otherwise exhaust the Postgres connection pool.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
