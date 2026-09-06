import { prisma } from "@m4/db";

/**
 * The authenticated caller. Authentication is not wired up yet; the shape is
 * fixed here so procedures can already scope their queries by tenant.
 */
export interface Session {
  userId: string;
  tenantId: string;
}

export interface Context {
  prisma: typeof prisma;
  session: Session | null;
  headers: Headers;
}

export function createTRPCContext(opts: { headers: Headers }): Context {
  return {
    prisma,
    // TODO(#auth): resolve the session from the request once auth lands.
    session: null,
    headers: opts.headers,
  };
}
