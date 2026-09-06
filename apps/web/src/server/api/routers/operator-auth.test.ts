import { SignInSurface, prisma } from "@m4/db";
import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { OPERATOR_SESSION_COOKIE, TENANT_SESSION_COOKIE } from "~/server/auth/cookies";
import { createOperatorSession, createUserSession } from "~/server/auth/session";
import { FAILURE_THRESHOLD, recordFailure } from "~/server/auth/throttle";
import {
  cookieHeader,
  createTestCaller,
  createTestOperator,
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

describe("operatorAuth.signIn", () => {
  it("signs in with correct credentials and sets the operator cookie", async () => {
    const { operator, password } = await createTestOperator();
    const { caller, resHeaders } = await createTestCaller();

    await caller.operatorAuth.signIn({ email: operator.email, password });

    const cookies = setCookieValues(resHeaders);
    expect(cookies.some((c) => c.startsWith(`${OPERATOR_SESSION_COOKIE}=`))).toBe(true);
    expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
    // Path=/ rather than /admin: the BFF lives at /api/trpc, so an
    // /admin-scoped cookie would never reach the procedures the console calls.
    expect(cookies.some((c) => c.includes("Path=/;"))).toBe(true);
    await expect(
      prisma.operatorSession.count({ where: { operatorId: operator.id } }),
    ).resolves.toBe(1);
  });

  it("accepts the address in any case, matching how it was created", async () => {
    const { operator, password } = await createTestOperator();
    const { caller } = await createTestCaller();

    await expect(
      caller.operatorAuth.signIn({ email: operator.email.toUpperCase(), password }),
    ).resolves.toBeUndefined();
  });

  it("refuses a wrong password and an unknown address identically", async () => {
    const { operator } = await createTestOperator();
    const { caller } = await createTestCaller();

    const wrongPassword = await asError(
      caller.operatorAuth.signIn({ email: operator.email, password: "definitely not it" }),
    );
    const unknownAddress = await asError(
      caller.operatorAuth.signIn({ email: uniqueEmail("nobody"), password: "definitely not it" }),
    );

    expect(wrongPassword.code).toBe("UNAUTHORIZED");
    expect(unknownAddress.code).toBe(wrongPassword.code);
    expect(unknownAddress.message).toBe(wrongPassword.message);
  });

  it("sets no cookie and creates no session when it refuses", async () => {
    const { operator } = await createTestOperator();
    const { caller, resHeaders } = await createTestCaller();

    await asError(caller.operatorAuth.signIn({ email: operator.email, password: "wrong" }));

    expect(setCookieValues(resHeaders)).toHaveLength(0);
    await expect(
      prisma.operatorSession.count({ where: { operatorId: operator.id } }),
    ).resolves.toBe(0);
  });

  it("throttles after repeated failures, so even the right password is refused", async () => {
    const { operator, password } = await createTestOperator();
    const { caller } = await createTestCaller({ client: `10.9.9.${uniqueSuffix()}` });

    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      await asError(caller.operatorAuth.signIn({ email: operator.email, password: "wrong" }));
    }

    const refusal = await asError(caller.operatorAuth.signIn({ email: operator.email, password }));

    expect(refusal.code).toBe("TOO_MANY_REQUESTS");
  });

  it("throttles an address with no account exactly the same way", async () => {
    const email = uniqueEmail("nobody");
    const { caller } = await createTestCaller({ client: `10.9.8.${uniqueSuffix()}` });

    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      await asError(caller.operatorAuth.signIn({ email, password: "wrong" }));
    }

    const refusal = await asError(caller.operatorAuth.signIn({ email, password: "wrong" }));

    expect(refusal.code).toBe("TOO_MANY_REQUESTS");
  });

  it("clears the account counter on a successful sign-in", async () => {
    const { operator, password } = await createTestOperator();
    await recordFailure({ surface: SignInSurface.OPERATOR, email: operator.email, client: null });

    const { caller } = await createTestCaller();
    await caller.operatorAuth.signIn({ email: operator.email, password });

    await expect(
      prisma.signInThrottle.count({
        where: { surface: SignInSurface.OPERATOR, key: operator.email },
      }),
    ).resolves.toBe(0);
  });

  it("counts against the operator surface only, leaving tenant sign-in alone", async () => {
    const { operator } = await createTestOperator();
    const { caller } = await createTestCaller();

    await asError(caller.operatorAuth.signIn({ email: operator.email, password: "wrong" }));

    await expect(
      prisma.signInThrottle.count({
        where: { surface: SignInSurface.TENANT, key: operator.email },
      }),
    ).resolves.toBe(0);
  });
});

describe("operatorAuth.me and signOut", () => {
  it("returns the signed-in operator", async () => {
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });

    await expect(caller.operatorAuth.me()).resolves.toEqual({
      id: operator.id,
      email: operator.email,
    });
  });

  it("signing out ends the session and clears the cookie", async () => {
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller, resHeaders } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });

    await caller.operatorAuth.signOut();

    expect(setCookieValues(resHeaders).some((c) => c.includes("Max-Age=0"))).toBe(true);
    await expect(
      prisma.operatorSession.findUnique({ where: { tokenHash: session.tokenHash } }),
    ).resolves.toBeNull();
  });
});

describe("the operator/tenant boundary", () => {
  it("refuses an anonymous caller", async () => {
    const { caller } = await createTestCaller();

    await expect(caller.operatorAuth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses a tenant user's session cookie", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const session = await createUserSession(user.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
    });

    await expect(caller.operatorAuth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses a tenant token even when presented in the operator cookie", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const session = await createUserSession(user.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });

    await expect(caller.operatorAuth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
