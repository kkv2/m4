import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@m4/db";

import { SESSION_MAX_AGE_SECONDS } from "./cookies";

/**
 * Sessions are rows in PostgreSQL keyed by an opaque random token. No
 * authentication library: two disjoint principal types, a blocking first-login
 * state and server-side revocation each fight the abstraction a library gives,
 * and none of the provider machinery a library exists for is in scope.
 *
 * Only the SHA-256 of a token is stored, so a database dump cannot be replayed
 * as a session.
 */

const TOKEN_BYTES = 32;

/**
 * A session's expiry slides forward on use (FR-023a), but writing on every
 * request would be pure waste. Only extend when the session is more than an
 * hour stale, which keeps the common case a read.
 */
const EXTEND_AFTER_MS = 60 * 60 * 1000;

export interface IssuedSession {
  /** The plaintext token. Returned once, here, and never stored. */
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ResolvedUserSession {
  tokenHash: string;
  userId: string;
  tenantId: string;
}

export interface ResolvedOperatorSession {
  tokenHash: string;
  operatorId: string;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  };
}

export async function createUserSession(userId: string): Promise<IssuedSession> {
  const { token, tokenHash, expiresAt } = newToken();
  await prisma.userSession.create({ data: { tokenHash, userId, expiresAt } });
  return { token, tokenHash, expiresAt };
}

export async function createOperatorSession(operatorId: string): Promise<IssuedSession> {
  const { token, tokenHash, expiresAt } = newToken();
  await prisma.operatorSession.create({ data: { tokenHash, operatorId, expiresAt } });
  return { token, tokenHash, expiresAt };
}

/**
 * Resolve a tenant-user token. Returns null for an unknown or expired token —
 * an expired row is deleted on the way past, which is the only sweeping this
 * feature does.
 */
export async function resolveUserSession(token: string): Promise<ResolvedUserSession | null> {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    select: {
      tokenHash: true,
      expiresAt: true,
      lastUsedAt: true,
      user: { select: { id: true, tenantId: true } },
    },
  });
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.userSession.deleteMany({ where: { tokenHash } });
    return null;
  }

  if (now.getTime() - session.lastUsedAt.getTime() > EXTEND_AFTER_MS) {
    await prisma.userSession.update({
      where: { tokenHash },
      data: {
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
      },
    });
  }

  return { tokenHash, userId: session.user.id, tenantId: session.user.tenantId };
}

export async function resolveOperatorSession(
  token: string,
): Promise<ResolvedOperatorSession | null> {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.operatorSession.findUnique({
    where: { tokenHash },
    select: { tokenHash: true, operatorId: true, expiresAt: true, lastUsedAt: true },
  });
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.operatorSession.deleteMany({ where: { tokenHash } });
    return null;
  }

  if (now.getTime() - session.lastUsedAt.getTime() > EXTEND_AFTER_MS) {
    await prisma.operatorSession.update({
      where: { tokenHash },
      data: {
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
      },
    });
  }

  return { tokenHash, operatorId: session.operatorId };
}

/** FR-023b: signing out ends the session that signed out, and only that one. */
export async function revokeUserSession(tokenHash: string): Promise<void> {
  await prisma.userSession.deleteMany({ where: { tokenHash } });
}

export async function revokeOperatorSession(tokenHash: string): Promise<void> {
  await prisma.operatorSession.deleteMany({ where: { tokenHash } });
}

/**
 * FR-023c: a password change or reissue ends every other session for that user.
 * `keepTokenHash` is the session performing the change, which continues; pass
 * null when an operator reissues, so nothing survives.
 */
export async function revokeOtherUserSessions(
  userId: string,
  keepTokenHash: string | null,
): Promise<void> {
  await prisma.userSession.deleteMany({
    where: keepTokenHash === null ? { userId } : { userId, NOT: { tokenHash: keepTokenHash } },
  });
}
