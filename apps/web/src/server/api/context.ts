import { type Language, prisma } from "@m4/db";

import { OPERATOR_SESSION_COOKIE, TENANT_SESSION_COOKIE, readCookie } from "~/server/auth/cookies";
import { resolveOperatorSession, resolveUserSession } from "~/server/auth/session";

/**
 * The authenticated caller. Two disjoint principal types, resolved from two
 * different cookies against two different tables, so that neither can ever be
 * mistaken for the other.
 *
 * This context reports what a caller *is*. What a caller may do is decided by
 * the procedure builders in ./trpc.ts, not here.
 */

export interface Session {
  userId: string;
  tenantId: string;
}

/** The tenant user behind a session, loaded once so procedures need not refetch. */
export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  language: Language;
  languageConfirmedAt: Date | null;
  mustChangePassword: boolean;
  firstLoginCompletedAt: Date | null;
  /** The session's token hash, so a procedure can spare its own session on revoke. */
  sessionTokenHash: string;
}

export interface SessionOperator {
  id: string;
  email: string;
  sessionTokenHash: string;
}

export interface Context {
  prisma: typeof prisma;
  session: Session | null;
  user: SessionUser | null;
  operator: SessionOperator | null;
  headers: Headers;
  /** Procedures append Set-Cookie here; the fetch handler passes it through. */
  resHeaders: Headers;
  /** The calling client, for per-client throttling. Null when undeterminable. */
  clientAddress: string | null;
}

/**
 * The client address, taken from `x-forwarded-for` when a proxy set it and from
 * the connection address otherwise. Locally this is usually `::1`, which is
 * correct: it is one client.
 */
function clientAddressFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() ?? null;
}

export async function resolveTenantUser(headers: Headers): Promise<SessionUser | null> {
  const token = readCookie(headers, TENANT_SESSION_COOKIE);
  if (!token) return null;

  const resolved = await resolveUserSession(token);
  if (!resolved) return null;

  const user = await prisma.user.findUnique({
    where: { id: resolved.userId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      language: true,
      languageConfirmedAt: true,
      mustChangePassword: true,
      firstLoginCompletedAt: true,
    },
  });
  if (!user) return null;

  return { ...user, sessionTokenHash: resolved.tokenHash };
}

export async function resolveOperator(headers: Headers): Promise<SessionOperator | null> {
  const token = readCookie(headers, OPERATOR_SESSION_COOKIE);
  if (!token) return null;

  const resolved = await resolveOperatorSession(token);
  if (!resolved) return null;

  const operator = await prisma.operator.findUnique({
    where: { id: resolved.operatorId },
    select: { id: true, email: true },
  });
  if (!operator) return null;

  return { ...operator, sessionTokenHash: resolved.tokenHash };
}

export async function createTRPCContext(opts: {
  headers: Headers;
  resHeaders?: Headers;
}): Promise<Context> {
  const [user, operator] = await Promise.all([
    resolveTenantUser(opts.headers),
    resolveOperator(opts.headers),
  ]);

  return {
    prisma,
    session: user ? { userId: user.id, tenantId: user.tenantId } : null,
    user,
    operator,
    headers: opts.headers,
    resHeaders: opts.resHeaders ?? new Headers(),
    clientAddress: clientAddressFrom(opts.headers),
  };
}
