import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 moved the connection URL out of schema.prisma and into this file.
 * It lives at the workspace root, next to the single shared .env.
 *
 * The .env is loaded by absolute path rather than through "dotenv/config",
 * which resolves against the current working directory — that would break
 * `prisma --config ../../prisma.config.ts` from inside a package. Variables
 * already set in the real environment (CI, the shell, the container) win.
 *
 * The runtime connection is separate: PrismaClient takes a driver adapter,
 * wired up in packages/db/src/index.ts.
 */
const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

loadDotenv({ path: path.join(workspaceRoot, ".env"), override: false, quiet: true });

export default defineConfig({
  schema: path.join(workspaceRoot, "packages/db/prisma/schema.prisma"),
  migrations: {
    path: path.join(workspaceRoot, "packages/db/prisma/migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
