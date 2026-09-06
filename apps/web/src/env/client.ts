import { z } from "zod";

/**
 * Client-side environment contract. Only NEXT_PUBLIC_* variables are readable
 * in the browser, and each one must be referenced literally so that Next.js can
 * inline it at build time.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
