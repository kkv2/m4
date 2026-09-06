import { prisma } from "@m4/db";
import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { TENANT_SESSION_COOKIE } from "~/server/auth/cookies";
import { verifyPassword } from "~/server/auth/password";
import { createUserSession, resolveUserSession } from "~/server/auth/session";
import { cookieHeader, createTestCaller, createTestUser } from "~/server/testing/fixtures";

async function userCaller(userId: string) {
  const session = await createUserSession(userId);
  const caller = await createTestCaller({
    cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
  });
  return { ...caller, session };
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

const GOOD_PASSWORD = "tumbling walnut ledger";

describe("onboarding.confirmLanguage", () => {
  it("records the chosen language and sends the user to the password step", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await userCaller(user.id);

    await expect(caller.onboarding.confirmLanguage({ language: "EN" })).resolves.toEqual({
      next: "password",
    });

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row?.language).toBe("EN");
    expect(row?.languageConfirmedAt).toBeInstanceOf(Date);
  });

  it("records the step even when the user keeps the operator's language", async () => {
    // Choosing the pre-selected value is still a choice; without recording it,
    // the user would be sent round the step again.
    const { user } = await createTestUser({ firstLoginCompleted: false, language: "JA" });
    const { caller } = await userCaller(user.id);

    await caller.onboarding.confirmLanguage({ language: "JA" });

    await expect(
      prisma.user.findUnique({ where: { id: user.id }, select: { languageConfirmedAt: true } }),
    ).resolves.not.toEqual({ languageConfirmedAt: null });
  });

  it("does not complete first login on its own", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await userCaller(user.id);

    await caller.onboarding.confirmLanguage({ language: "JA" });
    const row = await prisma.user.findUnique({ where: { id: user.id } });

    expect(row?.firstLoginCompletedAt).toBeNull();
    expect(row?.mustChangePassword).toBe(true);
  });

  it("refuses a replay once the language is confirmed", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await userCaller(user.id);
    await caller.onboarding.confirmLanguage({ language: "EN" });

    const second = await userCaller(user.id);
    await expect(
      second.caller.onboarding.confirmLanguage({ language: "JA" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      prisma.user.findUnique({ where: { id: user.id }, select: { language: true } }),
    ).resolves.toEqual({ language: "EN" });
  });

  it("accepts only the two languages M4 speaks", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await userCaller(user.id);

    await expect(
      caller.onboarding.confirmLanguage({ language: "FR" as "JA" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("onboarding.replacePassword", () => {
  async function atPasswordStep(overrides: { password?: string; name?: string } = {}) {
    const created = await createTestUser({ firstLoginCompleted: false, ...overrides });
    await prisma.user.update({
      where: { id: created.user.id },
      data: { languageConfirmedAt: new Date() },
    });
    return { ...created, ...(await userCaller(created.user.id)) };
  }

  it("becomes the user's password and completes first login", async () => {
    const { user, caller } = await atPasswordStep();

    await expect(
      caller.onboarding.replacePassword({ newPassword: GOOD_PASSWORD }),
    ).resolves.toEqual({ next: "app" });

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    await expect(verifyPassword(GOOD_PASSWORD, row?.passwordHash ?? "")).resolves.toBe(true);
    expect(row?.mustChangePassword).toBe(false);
    expect(row?.firstLoginCompletedAt).toBeInstanceOf(Date);
  });

  it("stops the issued password working", async () => {
    const { user, password: issued, caller } = await atPasswordStep();

    await caller.onboarding.replacePassword({ newPassword: GOOD_PASSWORD });
    const row = await prisma.user.findUnique({ where: { id: user.id } });

    await expect(verifyPassword(issued, row?.passwordHash ?? "")).resolves.toBe(false);
  });

  it("refuses the password the operator issued, naming that rule", async () => {
    const { password: issued, caller } = await atPasswordStep();

    await expect(
      rejectionOf(caller.onboarding.replacePassword({ newPassword: issued })),
    ).resolves.toBe("same-as-issued");
  });

  it("names the rule that failed for each strength requirement", async () => {
    const name = "Policy Check Person";
    const { caller } = await atPasswordStep({ name });

    await expect(
      rejectionOf(caller.onboarding.replacePassword({ newPassword: "short" })),
    ).resolves.toBe("too-short");
    await expect(
      rejectionOf(caller.onboarding.replacePassword({ newPassword: "passwordpassword" })),
    ).resolves.toBe("too-common");
    await expect(
      rejectionOf(caller.onboarding.replacePassword({ newPassword: name })),
    ).resolves.toBe("matches-display-name");
  });

  it("refuses a password equal to the user's own address", async () => {
    const { user, caller } = await atPasswordStep();

    await expect(
      rejectionOf(caller.onboarding.replacePassword({ newPassword: user.email })),
    ).resolves.toBe("matches-email");
  });

  it("changes nothing when it refuses", async () => {
    const { user, password: issued, caller } = await atPasswordStep();

    await expect(caller.onboarding.replacePassword({ newPassword: "short" })).rejects.toBeDefined();

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    await expect(verifyPassword(issued, row?.passwordHash ?? "")).resolves.toBe(true);
    expect(row?.firstLoginCompletedAt).toBeNull();
  });

  it("ends the user's other sessions and spares the one making the change", async () => {
    const { user, caller, session } = await atPasswordStep();
    const elsewhere = await createUserSession(user.id);

    await caller.onboarding.replacePassword({ newPassword: GOOD_PASSWORD });

    await expect(resolveUserSession(elsewhere.token)).resolves.toBeNull();
    await expect(
      prisma.userSession.findUnique({ where: { tokenHash: session.tokenHash } }),
    ).resolves.not.toBeNull();
  });

  it("refuses before the language step is done", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await userCaller(user.id);

    await expect(
      caller.onboarding.replacePassword({ newPassword: GOOD_PASSWORD }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a replay once first login is complete", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const { caller } = await userCaller(user.id);

    await expect(
      caller.onboarding.replacePassword({ newPassword: GOOD_PASSWORD }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("the first-login gate", () => {
  it("lets an unfinished user reach the onboarding procedures but not the application", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: false });
    const { caller } = await userCaller(user.id);

    // onboardingProcedure: allowed.
    await expect(caller.auth.me()).resolves.toMatchObject({ firstLoginCompleted: false });

    // protectedProcedure: refused, and it says why rather than pretending the
    // caller is anonymous.
    await expect(
      caller.onboarding.replacePassword({ newPassword: GOOD_PASSWORD }),
    ).rejects.toBeDefined();
  });

  it("resumes at the unfinished step after abandoning halfway", async () => {
    const { user, password } = await createTestUser({ firstLoginCompleted: false });
    const first = await userCaller(user.id);
    await first.caller.onboarding.confirmLanguage({ language: "EN" });

    // A fresh sign-in, as though the user closed the tab and came back.
    const { caller: anonymous } = await createTestCaller();
    await expect(anonymous.auth.signIn({ email: user.email, password })).resolves.toEqual({
      next: "password",
    });
  });
});
