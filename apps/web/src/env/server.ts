import { z } from "zod";

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
