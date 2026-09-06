import fs from "node:fs";
import path from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/**
 * One .env file lives at the workspace root and is shared by every package.
 * Next.js only reads the one inside apps/web, so walk up to the root and load
 * that file as well. Variables already set in the real environment — CI, the
 * shell, the container — are left alone.
 */
function loadWorkspaceRootEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      loadDotenv({ path: path.join(dir, ".env"), override: false, quiet: true });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

loadWorkspaceRootEnv();

/**
 * Server-side environment contract. Parsed once at module load so a
 * misconfigured deployment fails at boot instead of on the first request.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
});

const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "true" || process.env.NODE_ENV === "test";

function parseServerEnv(): z.infer<typeof serverEnvSchema> {
  if (skipValidation) {
    return process.env as unknown as z.infer<typeof serverEnvSchema>;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = parseServerEnv();
