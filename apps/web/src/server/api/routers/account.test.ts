import { prisma } from "@m4/db";
import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { appRouter } from "~/server/api/root";
import { OPERATOR_SESSION_COOKIE, TENANT_SESSION_COOKIE } from "~/server/auth/cookies";
import { verifyPassword } from "~/server/auth/password";
import {
  createOperatorSession,
  createUserSession,
  resolveUserSession,
} from "~/server/auth/session";
import {
  cookieHeader,
  createTestCaller,
  createTestOperator,
  createTestUser,
} from "~/server/testing/fixtures";

async function signedIn(options: Parameters<typeof createTestUser>[0] = {}) {
  const created = await createTestUser({ firstLoginCompleted: true, ...options });
  const session = await createUserSession(created.user.id);
  const caller = await createTestCaller({
    cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
  });
  return { ...created, ...caller, session };
}

async function rejectionOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => {
      throw new Error("expected the call to be refused, but it succeeded");
    },
    (thrown: unknown) => thrown as TRPCError,
  );
  return error.message;
}

const NEW_PASSWORD = "cantilever moss inventory";

describe("account.get", () => {
  it("returns the identifier, address, display name and language", async () => {
    const { user, caller } = await signedIn({ name: "山田 花子", language: "JA" });

    await expect(caller.account.get()).resolves.toEqual({
      id: user.id,
      email: user.email,
      displayName: "山田 花子",
      language: "JA",
    });
  });

  it("never returns a password or a hash", async () => {
    const { password, caller } = await signedIn();

    const account = await caller.account.get();

    expect(JSON.stringify(account)).not.toContain(password);
    expect(JSON.stringify(account)).not.toContain("passwordHash");
  });
});

describe("account.updateDisplayName", () => {
  it("changes the name and persists it", async () => {
    const { user, caller } = await signedIn({ name: "Before" });

    await caller.account.updateDisplayName({ displayName: "After" });

    await expect(
      prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    ).resolves.toEqual({ name: "After" });
  });

  it("trims rather than storing the padding", async () => {
    const { user, caller } = await signedIn();

    await caller.account.updateDisplayName({ displayName: "  Padded  " });

    await expect(
      prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    ).resolves.toEqual({ name: "Padded" });
  });

  it("refuses an empty name", async () => {
    const { user, caller } = await signedIn({ name: "Keep me" });

    await expect(caller.account.updateDisplayName({ displayName: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    ).resolves.toEqual({ name: "Keep me" });
  });
});

describe("account.updateLanguage", () => {
  it("changes the language and persists it", async () => {
    const { user, caller } = await signedIn({ language: "JA" });

    await caller.account.updateLanguage({ language: "EN" });

    await expect(
      prisma.user.findUnique({ where: { id: user.id }, select: { language: true } }),
    ).resolves.toEqual({ language: "EN" });
  });

  it("accepts only the two languages M4 speaks", async () => {
    const { caller } = await signedIn();

    await expect(caller.account.updateLanguage({ language: "FR" as "JA" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("account.changePassword", () => {
  it("changes the password when the current one is right", async () => {
    const { user, password, caller } = await signedIn();

    await caller.account.changePassword({
      currentPassword: password,
      newPassword: NEW_PASSWORD,
    });

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    await expect(verifyPassword(NEW_PASSWORD, row?.passwordHash ?? "")).resolves.toBe(true);
    await expect(verifyPassword(password, row?.passwordHash ?? "")).resolves.toBe(false);
  });

  it("refuses a wrong current password, and changes nothing", async () => {
    const { user, password, caller } = await signedIn();

    await expect(
      rejectionOf(
        caller.account.changePassword({ currentPassword: "not it", newPassword: NEW_PASSWORD }),
      ),
    ).resolves.toBe("current-incorrect");

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    await expect(verifyPassword(password, row?.passwordHash ?? "")).resolves.toBe(true);
  });

  it("refuses a new password identical to the current one", async () => {
    const { password, caller } = await signedIn();

    await expect(
      rejectionOf(
        caller.account.changePassword({ currentPassword: password, newPassword: password }),
      ),
    ).resolves.toBe("same-as-current");
  });

  it("names the rule that failed for each strength requirement", async () => {
    const name = "Settings Check Person";
    const { user, password, caller } = await signedIn({ name });

    const cases: [string, string][] = [
      ["short", "too-short"],
      ["passwordpassword", "too-common"],
      [user.email, "matches-email"],
      [name, "matches-display-name"],
    ];

    for (const [attempt, rule] of cases) {
      await expect(
        rejectionOf(
          caller.account.changePassword({ currentPassword: password, newPassword: attempt }),
        ),
      ).resolves.toBe(rule);
    }
  });

  it("ends the user's other sessions and keeps the one making the change", async () => {
    const { user, password, caller, session } = await signedIn();
    const elsewhere = await createUserSession(user.id);

    await caller.account.changePassword({
      currentPassword: password,
      newPassword: NEW_PASSWORD,
    });

    await expect(resolveUserSession(elsewhere.token)).resolves.toBeNull();
    await expect(
      prisma.userSession.findUnique({ where: { tokenHash: session.tokenHash } }),
    ).resolves.not.toBeNull();
  });

  it("leaves another user's sessions alone", async () => {
    const { password, caller } = await signedIn();
    const bystander = await signedIn();

    await caller.account.changePassword({
      currentPassword: password,
      newPassword: NEW_PASSWORD,
    });

    await expect(resolveUserSession(bystander.session.token)).resolves.not.toBeNull();
  });
});

/** The field names one procedure accepts, read off its Zod input schema. */
function inputKeysOf(procedureName: string): string[] {
  const procedure = (appRouter._def.procedures as Record<string, unknown>)[procedureName];
  const inputs = (procedure as { _def?: { inputs?: unknown[] } })._def?.inputs ?? [];

  return inputs.flatMap((schema) => {
    const shape = (schema as { shape?: Record<string, unknown> }).shape;
    return shape ? Object.keys(shape) : [];
  });
}

describe("who these procedures act on", () => {
  it("takes no user id anywhere, so acting on someone else cannot be expressed", () => {
    // FR-041 as a shape rather than a check: every procedure works from the
    // session. Adding a `userId` input is the thing to catch in review, and
    // this fails the moment one appears.
    expect(inputKeysOf("account.get")).toEqual([]);
    expect(inputKeysOf("account.updateDisplayName")).toEqual(["displayName"]);
    expect(inputKeysOf("account.updateLanguage")).toEqual(["language"]);
    expect(inputKeysOf("account.changePassword").sort()).toEqual([
      "currentPassword",
      "newPassword",
    ]);
  });

  it("has no procedure that changes an email address", () => {
    const procedures = Object.keys(appRouter._def.procedures)
      .filter((name) => name.startsWith("account."))
      .map((name) => name.replace("account.", ""))
      .sort();

    expect(procedures).toEqual(["changePassword", "get", "updateDisplayName", "updateLanguage"]);
  });
});

describe("who may reach these procedures", () => {
  it("refuses an anonymous caller", async () => {
    const { caller } = await createTestCaller();

    await expect(caller.account.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses an operator", async () => {
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });

    await expect(caller.account.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses a user whose first login is not complete", async () => {
    // Settings sit behind protectedProcedure, so they are closed until both
    // first-login steps are done (FR-034).
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const session = await createUserSession(user.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
    });

    await expect(caller.account.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
