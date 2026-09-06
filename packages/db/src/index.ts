import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client/client.ts";

export * from "./generated/client/client.ts";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma 7 no longer takes the connection URL from schema.prisma. The client
 * connects through a driver adapter instead — node-postgres here, against the
 * plain PostgreSQL that docker/docker-compose.yml starts. prisma.config.ts at
 * the workspace root covers the CLI side (migrate, db push, studio).
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the workspace root.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

/**
 * A single PrismaClient per process. Next.js dev mode re-evaluates modules on
 * every hot reload, which would otherwise exhaust the Postgres connection pool.
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
