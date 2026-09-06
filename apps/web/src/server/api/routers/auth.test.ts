import { SignInSurface, prisma } from "@m4/db";
import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { OPERATOR_SESSION_COOKIE, TENANT_SESSION_COOKIE } from "~/server/auth/cookies";
import { createOperatorSession, createUserSession } from "~/server/auth/session";
import { FAILURE_THRESHOLD, WINDOW_MS } from "~/server/auth/throttle";
import {
  cookieHeader,
  createTestCaller,
  createTestOperator,
  createTestTenant,
  createTestUser,
  setCookieValues,
  uniqueEmail,
  uniqueSuffix,
} from "~/server/testing/fixtures";

async function asError(promise: Promise<unknown>): Promise<TRPCError> {
  return promise.then(
    () => {
      throw new Error("expected the call to be refused, but it succeeded");
    },
    (error: unknown) => error as TRPCError,
  );
}

/** A caller carrying a signed-in tenant user's session. */
async function userCaller(userId: string) {
  const session = await createUserSession(userId);
  const caller = await createTestCaller({
    cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
  });
  return { ...caller, session };
}

describe("auth.signIn", () => {
  it("takes an address and a password and nothing else, and sets the session cookie", async () => {
    const { user, password } = await createTestUser({ firstLoginCompleted: true });
    const { caller, resHeaders } = await createTestCaller();

    const result = await caller.auth.signIn({ email: user.email, password });

    expect(result).toEqual({ next: "app" });
    const cookies = setCookieValues(resHeaders);
    expect(cookies.some((c) => c.startsWith(`${TENANT_SESSION_COOKIE}=`))).toBe(true);
    expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
  });

  it("resolves the tenant from the address, with no tenant identifier supplied", async () => {
    const tenant = await createTestTenant();
    const { user, password } = await createTestUser({
      tenantId: tenant.id,
      firstLoginCompleted: true,
    });
    const { caller, resHeaders } = await createTestCaller();

    await caller.auth.signIn({ email: user.email, password });

    const [cookie] = setCookieValues(resHeaders);
    const token = decodeURIComponent(cookie?.split(";")[0]?.split("=")[1] ?? "");
    const signedIn = await createTestCaller({
      cookie: cookieHeader(TENANT_SESSION_COOKIE, token),
    });

    await expect(signedIn.caller.auth.me()).resolves.toMatchObject({ tenantId: tenant.id });
  });

  it("sends a freshly registered user to the language step", async () => {
    const { user, password } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await createTestCaller();

    await expect(caller.auth.signIn({ email: user.email, password })).resolves.toEqual({
      next: "language",
    });
  });

  it("sends a user who confirmed a language but kept the issued password to the password step", async () => {
    const { user, password } = await createTestUser({ firstLoginCompleted: false });
    await prisma.user.update({
      where: { id: user.id },
      data: { languageConfirmedAt: new Date() },
    });
    const { caller } = await createTestCaller();

    await expect(caller.auth.signIn({ email: user.email, password })).resolves.toEqual({
      next: "password",
    });
  });

  it("sends a user who has finished straight to the application", async () => {
    const { user, password } = await createTestUser({ firstLoginCompleted: true });
    const { caller } = await createTestCaller();

    await expect(caller.auth.signIn({ email: user.email, password })).resolves.toEqual({
      next: "app",
    });
  });

  it("refuses a wrong password and an unknown address identically", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const { caller } = await createTestCaller();

    const wrong = await asError(caller.auth.signIn({ email: user.email, password: "not it" }));
    const unknown = await asError(
      caller.auth.signIn({ email: uniqueEmail("nobody"), password: "not it" }),
    );

    expect(wrong.code).toBe("UNAUTHORIZED");
    expect(unknown.code).toBe(wrong.code);
    expect(unknown.message).toBe(wrong.message);
  });

  it("sets no cookie and creates no session when it refuses", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const { caller, resHeaders } = await createTestCaller();

    await asError(caller.auth.signIn({ email: user.email, password: "wrong" }));

    expect(setCookieValues(resHeaders)).toHaveLength(0);
    await expect(prisma.userSession.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("throttles repeated failures, then releases once the window passes", async () => {
    const { user, password } = await createTestUser({ firstLoginCompleted: true });
    const client = `10.7.7.${uniqueSuffix()}`;
    const { caller } = await createTestCaller({ client });

    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      await asError(caller.auth.signIn({ email: user.email, password: "wrong" }));
    }
    const blocked = await asError(caller.auth.signIn({ email: user.email, password }));
    expect(blocked.code).toBe("TOO_MANY_REQUESTS");

    // Age the window rather than waiting fifteen minutes — scoped to the two
    // keys this test owns. Ageing the whole surface would reach into rows other
    // test files are relying on, and did.
    await prisma.signInThrottle.updateMany({
      where: { surface: SignInSurface.TENANT, key: { in: [user.email, client] } },
      data: { windowStartedAt: new Date(Date.now() - WINDOW_MS - 1000) },
    });

    await expect(caller.auth.signIn({ email: user.email, password })).resolves.toEqual({
      next: "app",
    });
  });

  it("counts against the tenant surface only, leaving the operator console alone", async () => {
    const { user } = await createTestUser();
    const { caller } = await createTestCaller();

    await asError(caller.auth.signIn({ email: user.email, password: "wrong" }));

    await expect(
      prisma.signInThrottle.count({
        where: { surface: SignInSurface.OPERATOR, key: user.email },
      }),
    ).resolves.toBe(0);
  });
});

describe("auth.me", () => {
  it("returns the account and its tenant, and never a password", async () => {
    const tenant = await createTestTenant({ name: `Acme ${uniqueSuffix()}` });
    const { user, password } = await createTestUser({
      tenantId: tenant.id,
      firstLoginCompleted: true,
    });
    const { caller } = await userCaller(user.id);

    const me = await caller.auth.me();

    expect(me).toMatchObject({
      id: user.id,
      email: user.email,
      displayName: user.name,
      tenantId: tenant.id,
      tenantName: tenant.name,
      firstLoginCompleted: true,
      next: "app",
    });
    expect(JSON.stringify(me)).not.toContain(password);
    expect(JSON.stringify(me)).not.toContain("passwordHash");
  });

  it("is available before first login is complete, and reports where to go", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await userCaller(user.id);

    await expect(caller.auth.me()).resolves.toMatchObject({
      firstLoginCompleted: false,
      next: "language",
    });
  });
});

describe("auth.signOut", () => {
  it("ends that session and clears the cookie", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const { caller, resHeaders, session } = await userCaller(user.id);

    await caller.auth.signOut();

    expect(setCookieValues(resHeaders).some((c) => c.includes("Max-Age=0"))).toBe(true);
    await expect(
      prisma.userSession.findUnique({ where: { tokenHash: session.tokenHash } }),
    ).resolves.toBeNull();
  });

  it("leaves that user's other sessions alone", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const elsewhere = await createUserSession(user.id);
    const { caller } = await userCaller(user.id);

    await caller.auth.signOut();

    await expect(
      prisma.userSession.findUnique({ where: { tokenHash: elsewhere.tokenHash } }),
    ).resolves.not.toBeNull();
  });
});

describe("the operator/tenant boundary", () => {
  it("refuses an anonymous caller", async () => {
    const { caller } = await createTestCaller();

    await expect(caller.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses an operator's session cookie", async () => {
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });

    await expect(caller.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses an operator token presented in the tenant cookie", async () => {
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
    });

    await expect(caller.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("tenant isolation", () => {
  it("gives a signed-in user no path to another tenant's data", async () => {
    // SC-007, asserted by calling procedures directly rather than through the
    // UI — the point is that bypassing the interface changes nothing.
    const mine = await createTestTenant();
    const theirs = await createTestTenant({ name: `Other ${uniqueSuffix()}` });
    const { user } = await createTestUser({ tenantId: mine.id, firstLoginCompleted: true });
    await createTestUser({ tenantId: theirs.id, firstLoginCompleted: true });
    const { caller } = await userCaller(user.id);

    const me = await caller.auth.me();
    expect(me.tenantId).toBe(mine.id);
    expect(me.tenantName).not.toBe(theirs.name);

    // Every operator procedure — the only ones that read across tenants — is
    // closed to a tenant user, whichever tenant they name.
    await expect(caller.admin.tenants.get({ tenantId: theirs.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.admin.users.listByTenant({ tenantId: theirs.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.admin.tenants.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
