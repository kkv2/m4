import { prisma } from "@m4/db";
import { describe, expect, it } from "vitest";

import { createTestOperator, createTestUser } from "~/server/testing/fixtures";

import {
  createOperatorSession,
  createUserSession,
  hashSessionToken,
  resolveOperatorSession,
  resolveUserSession,
  revokeOperatorSession,
  revokeOtherUserSessions,
  revokeUserSession,
} from "./session";

describe("user sessions", () => {
  it("issues a token that resolves back to the user and their tenant", async () => {
    const { user } = await createTestUser();

    const issued = await createUserSession(user.id);
    const resolved = await resolveUserSession(issued.token);

    expect(resolved).toEqual({
      tokenHash: issued.tokenHash,
      userId: user.id,
      tenantId: user.tenantId,
    });
  });

  it("stores only the hash, never the token", async () => {
    const { user } = await createTestUser();

    const issued = await createUserSession(user.id);
    const row = await prisma.userSession.findUnique({ where: { tokenHash: issued.tokenHash } });

    expect(row?.tokenHash).toBe(hashSessionToken(issued.token));
    expect(JSON.stringify(row)).not.toContain(issued.token);
  });

  it("issues a different token every time", async () => {
    const { user } = await createTestUser();

    const [a, b] = await Promise.all([createUserSession(user.id), createUserSession(user.id)]);

    expect(a.token).not.toBe(b.token);
  });

  it("does not resolve an unknown token", async () => {
    await expect(resolveUserSession("not-a-real-token")).resolves.toBeNull();
  });

  it("does not resolve an expired token, and clears the row on the way past", async () => {
    const { user } = await createTestUser();
    const issued = await createUserSession(user.id);

    await prisma.userSession.update({
      where: { tokenHash: issued.tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(resolveUserSession(issued.token)).resolves.toBeNull();
    await expect(
      prisma.userSession.findUnique({ where: { tokenHash: issued.tokenHash } }),
    ).resolves.toBeNull();
  });

  it("slides the expiry once the session is more than an hour stale", async () => {
    const { user } = await createTestUser();
    const issued = await createUserSession(user.id);

    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.userSession.update({
      where: { tokenHash: issued.tokenHash },
      data: { lastUsedAt: stale, expiresAt: new Date(Date.now() + 60_000) },
    });

    await resolveUserSession(issued.token);
    const after = await prisma.userSession.findUnique({ where: { tokenHash: issued.tokenHash } });

    expect(after?.lastUsedAt.getTime()).toBeGreaterThan(stale.getTime());
    expect(after?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });

  it("leaves a fresh session alone, so the common case is a pure read", async () => {
    const { user } = await createTestUser();
    const issued = await createUserSession(user.id);
    const before = await prisma.userSession.findUnique({ where: { tokenHash: issued.tokenHash } });

    await resolveUserSession(issued.token);
    const after = await prisma.userSession.findUnique({ where: { tokenHash: issued.tokenHash } });

    expect(after?.lastUsedAt.getTime()).toBe(before?.lastUsedAt.getTime());
  });
});

describe("revocation", () => {
  it("signing out ends that session and only that session", async () => {
    const { user } = await createTestUser();
    const kept = await createUserSession(user.id);
    const closed = await createUserSession(user.id);

    await revokeUserSession(closed.tokenHash);

    await expect(resolveUserSession(closed.token)).resolves.toBeNull();
    await expect(resolveUserSession(kept.token)).resolves.not.toBeNull();
  });

  it("a password change ends every other session and spares the caller's", async () => {
    const { user } = await createTestUser();
    const caller = await createUserSession(user.id);
    const elsewhere = await createUserSession(user.id);
    const alsoElsewhere = await createUserSession(user.id);

    await revokeOtherUserSessions(user.id, caller.tokenHash);

    await expect(resolveUserSession(caller.token)).resolves.not.toBeNull();
    await expect(resolveUserSession(elsewhere.token)).resolves.toBeNull();
    await expect(resolveUserSession(alsoElsewhere.token)).resolves.toBeNull();
  });

  it("an operator reissue ends every session, keeping none", async () => {
    const { user } = await createTestUser();
    const one = await createUserSession(user.id);
    const two = await createUserSession(user.id);

    await revokeOtherUserSessions(user.id, null);

    await expect(resolveUserSession(one.token)).resolves.toBeNull();
    await expect(resolveUserSession(two.token)).resolves.toBeNull();
  });

  it("does not touch another user's sessions", async () => {
    const { user: mine } = await createTestUser();
    const { user: theirs } = await createTestUser();
    const myToken = await createUserSession(mine.id);
    const theirToken = await createUserSession(theirs.id);

    await revokeOtherUserSessions(mine.id, null);

    expect(myToken.token).not.toBe(theirToken.token);
    await expect(resolveUserSession(theirToken.token)).resolves.not.toBeNull();
  });
});

describe("the operator/tenant boundary", () => {
  it("an operator token does not resolve as a user session", async () => {
    const { operator } = await createTestOperator();
    const issued = await createOperatorSession(operator.id);

    await expect(resolveUserSession(issued.token)).resolves.toBeNull();
    await expect(resolveOperatorSession(issued.token)).resolves.toEqual({
      tokenHash: issued.tokenHash,
      operatorId: operator.id,
    });
  });

  it("a user token does not resolve as an operator session", async () => {
    const { user } = await createTestUser();
    const issued = await createUserSession(user.id);

    await expect(resolveOperatorSession(issued.token)).resolves.toBeNull();
  });

  it("revoking an operator session leaves user sessions alone", async () => {
    const { operator } = await createTestOperator();
    const { user } = await createTestUser();
    const operatorSession = await createOperatorSession(operator.id);
    const userSession = await createUserSession(user.id);

    await revokeOperatorSession(operatorSession.tokenHash);

    await expect(resolveOperatorSession(operatorSession.token)).resolves.toBeNull();
    await expect(resolveUserSession(userSession.token)).resolves.not.toBeNull();
  });
});
