import { headers } from "next/headers";

import {
  resolveOperator,
  resolveTenantUser,
  type SessionOperator,
  type SessionUser,
} from "~/server/api/context";

/**
 * Session reads for Server Components.
 *
 * Route-group layouts use these to redirect on the way in, so no screen renders
 * for the wrong principal. That redirect is a convenience on top of the real
 * enforcement, which lives in the procedure builders: a layout that forgets a
 * check wastes a render, whereas a procedure that forgets one is a breach.
 *
 * There is no middleware. Next.js middleware runs on the Edge runtime, where
 * Prisma and node:crypto's scrypt are unavailable — resolving a database-backed
 * session is precisely what it cannot do.
 */

export async function currentOperator(): Promise<SessionOperator | null> {
  return resolveOperator(await headers());
}

export async function currentUser(): Promise<SessionUser | null> {
  return resolveTenantUser(await headers());
}
