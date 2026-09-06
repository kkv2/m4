import { Language, prisma } from "@m4/db";
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
  createTestTenant,
  createTestUser,
  uniqueEmail,
  uniqueSuffix,
} from "~/server/testing/fixtures";

async function operatorCaller() {
  const { operator } = await createTestOperator();
  const session = await createOperatorSession(operator.id);
  return createTestCaller({ cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token) });
}

function registration(tenantId: string, overrides: Partial<{ email: string; name: string }> = {}) {
  return {
    tenantId,
    email: overrides.email ?? uniqueEmail("member"),
    name: overrides.name ?? "Test Member",
    language: Language.JA,
  };
}

describe("admin.users.create", () => {
  it("registers a user and returns a password that verifies against the stored hash", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();
    const input = registration(tenant.id);

    const { id, generatedPassword } = await caller.admin.users.create(input);
    const row = await prisma.user.findUnique({ where: { id } });

    expect(row?.email).toBe(input.email);
    expect(row?.name).toBe(input.name);
    expect(row?.tenantId).toBe(tenant.id);
    await expect(verifyPassword(generatedPassword, row?.passwordHash ?? "")).resolves.toBe(true);
  });

  it("generates the password rather than taking one, and never stores it in plaintext", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();

    const first = await caller.admin.users.create(registration(tenant.id));
    const second = await caller.admin.users.create(registration(tenant.id));
    const row = await prisma.user.findUnique({ where: { id: first.id } });

    expect(first.generatedPassword).not.toBe(second.generatedPassword);
    expect(first.generatedPassword.length).toBeGreaterThanOrEqual(24);
    expect(JSON.stringify(row)).not.toContain(first.generatedPassword);
  });

  it("starts the user before both first-login steps", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();

    const { id } = await caller.admin.users.create(registration(tenant.id));
    const row = await prisma.user.findUnique({ where: { id } });

    expect(row?.mustChangePassword).toBe(true);
    expect(row?.languageConfirmedAt).toBeNull();
    expect(row?.firstLoginCompletedAt).toBeNull();
  });

  it("records the language the operator chose", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant({ defaultLanguage: Language.EN });

    const { id } = await caller.admin.users.create({
      ...registration(tenant.id),
      language: Language.EN,
    });

    await expect(
      prisma.user.findUnique({ where: { id }, select: { language: true } }),
    ).resolves.toEqual({ language: Language.EN });
  });

  it("refuses an address already registered to the same tenant", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();
    const email = uniqueEmail("dupe");
    await caller.admin.users.create(registration(tenant.id, { email }));

    await expect(
      caller.admin.users.create(registration(tenant.id, { email })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it("refuses an address registered to a different tenant, because addresses are unique platform-wide", async () => {
    const { caller } = await operatorCaller();
    const mine = await createTestTenant();
    const theirs = await createTestTenant();
    const email = uniqueEmail("shared");
    await caller.admin.users.create(registration(theirs.id, { email }));

    await expect(caller.admin.users.create(registration(mine.id, { email }))).rejects.toMatchObject(
      {
        code: "CONFLICT",
      },
    );
  });

  it("does not name the holding tenant when it refuses", async () => {
    const { caller } = await operatorCaller();
    const holder = await createTestTenant({ name: `Secret Holder ${uniqueSuffix()}` });
    const other = await createTestTenant();
    const email = uniqueEmail("shared");
    await caller.admin.users.create(registration(holder.id, { email }));

    const error = await caller.admin.users.create(registration(other.id, { email })).then(
      () => {
        throw new Error("expected the registration to be refused, but it succeeded");
      },
      (thrown: unknown) => thrown as Error,
    );

    expect(error.message).not.toContain(holder.name);
    expect(error.message).not.toContain(holder.id);
  });

  it("treats an address as taken regardless of case", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();
    const email = uniqueEmail("Case");
    await caller.admin.users.create(registration(tenant.id, { email }));

    await expect(
      caller.admin.users.create(registration(tenant.id, { email: email.toUpperCase() })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses an empty display name and a malformed address", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();

    await expect(
      caller.admin.users.create(registration(tenant.id, { name: "   " })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.admin.users.create(registration(tenant.id, { email: "not-an-address" })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses an unknown tenant rather than creating an orphan", async () => {
    const { caller } = await operatorCaller();

    await expect(
      caller.admin.users.create(registration("clzzzzzzzzzzzzzzzzzzzzzzz")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin.users.listByTenant", () => {
  it("lists the tenant's users with their identifier and first-login status", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();
    const { user } = await createTestUser({ tenantId: tenant.id });

    const list = await caller.admin.users.listByTenant({ tenantId: tenant.id });

    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(user.id);
    expect(list[0]?.email).toBe(user.email);
    expect(list[0]?.firstLoginCompletedAt).toBeNull();
  });

  it("shows a completed first login once it has happened", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();
    await createTestUser({ tenantId: tenant.id, firstLoginCompleted: true });

    const list = await caller.admin.users.listByTenant({ tenantId: tenant.id });

    expect(list[0]?.firstLoginCompletedAt).toBeInstanceOf(Date);
  });

  it("lists no other tenant's users", async () => {
    const { caller } = await operatorCaller();
    const mine = await createTestTenant();
    const theirs = await createTestTenant();
    await createTestUser({ tenantId: mine.id });
    const { user: outsider } = await createTestUser({ tenantId: theirs.id });

    const list = await caller.admin.users.listByTenant({ tenantId: mine.id });

    expect(list.map((u) => u.id)).not.toContain(outsider.id);
  });

  it("returns an empty list for a tenant with no users, not an error", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();

    await expect(caller.admin.users.listByTenant({ tenantId: tenant.id })).resolves.toEqual([]);
  });

  it("never returns a password or a hash", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();
    await createTestUser({ tenantId: tenant.id });

    const list = await caller.admin.users.listByTenant({ tenantId: tenant.id });

    expect(JSON.stringify(list)).not.toContain("passwordHash");
    expect(JSON.stringify(list)).not.toContain("scrypt$");
  });
});

describe("admin.users.reissuePassword", () => {
  it("issues a new password and invalidates the old one", async () => {
    const { caller } = await operatorCaller();
    const { user, password: issued } = await createTestUser();

    const { generatedPassword } = await caller.admin.users.reissuePassword({ userId: user.id });
    const row = await prisma.user.findUnique({ where: { id: user.id } });

    await expect(verifyPassword(generatedPassword, row?.passwordHash ?? "")).resolves.toBe(true);
    await expect(verifyPassword(issued, row?.passwordHash ?? "")).resolves.toBe(false);
  });

  it("ends every session that user had, keeping none", async () => {
    const { caller } = await operatorCaller();
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const one = await createUserSession(user.id);
    const two = await createUserSession(user.id);

    await caller.admin.users.reissuePassword({ userId: user.id });

    await expect(resolveUserSession(one.token)).resolves.toBeNull();
    await expect(resolveUserSession(two.token)).resolves.toBeNull();
  });

  it("leaves another user's sessions alone", async () => {
    const { caller } = await operatorCaller();
    const { user: target } = await createTestUser();
    const { user: bystander } = await createTestUser({ firstLoginCompleted: true });
    const bystanderSession = await createUserSession(bystander.id);

    await caller.admin.users.reissuePassword({ userId: target.id });

    await expect(resolveUserSession(bystanderSession.token)).resolves.not.toBeNull();
  });

  it("does not re-trigger first login for a user who has completed it", async () => {
    const { caller } = await operatorCaller();
    const { user } = await createTestUser({ firstLoginCompleted: true });

    await caller.admin.users.reissuePassword({ userId: user.id });
    const row = await prisma.user.findUnique({ where: { id: user.id } });

    expect(row?.firstLoginCompletedAt).toBeInstanceOf(Date);
    expect(row?.mustChangePassword).toBe(false);
  });

  it("leaves an unfinished user still owing both steps", async () => {
    const { caller } = await operatorCaller();
    const { user } = await createTestUser({ firstLoginCompleted: false });

    await caller.admin.users.reissuePassword({ userId: user.id });
    const row = await prisma.user.findUnique({ where: { id: user.id } });

    expect(row?.firstLoginCompletedAt).toBeNull();
    expect(row?.mustChangePassword).toBe(true);
  });

  it("does not change the address, the display name or the language", async () => {
    const { caller } = await operatorCaller();
    const { user } = await createTestUser();

    await caller.admin.users.reissuePassword({ userId: user.id });
    const row = await prisma.user.findUnique({ where: { id: user.id } });

    expect(row?.email).toBe(user.email);
    expect(row?.name).toBe(user.name);
    expect(row?.language).toBe(user.language);
  });

  it("is a not-found for an unknown user", async () => {
    const { caller } = await operatorCaller();

    await expect(
      caller.admin.users.reissuePassword({ userId: "clzzzzzzzzzzzzzzzzzzzzzzz" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("who may reach these procedures", () => {
  it("refuses an anonymous caller, and creates nothing", async () => {
    const tenant = await createTestTenant();
    const email = uniqueEmail("refused");
    const { caller } = await createTestCaller();

    await expect(caller.admin.users.listByTenant({ tenantId: tenant.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller.admin.users.create(registration(tenant.id, { email })),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
  });

  it("refuses a signed-in tenant user, even one in the tenant being asked about", async () => {
    const tenant = await createTestTenant();
    const { user } = await createTestUser({ tenantId: tenant.id, firstLoginCompleted: true });
    const session = await createUserSession(user.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
    });

    await expect(caller.admin.users.listByTenant({ tenantId: tenant.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.admin.users.reissuePassword({ userId: user.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("what this router deliberately does not offer", () => {
  it("has no procedure that changes an email address, and none that deletes", () => {
    // FR-018 makes the address immutable and FR-046 forbids deletion. Both are
    // properties of what is absent, so the assertion is on the router's shape:
    // adding `update` or `delete` here should fail this test and make whoever
    // added it go and read the spec.
    const procedures = Object.keys(appRouter._def.procedures)
      .filter((name) => name.startsWith("admin.users."))
      .map((name) => name.replace("admin.users.", ""))
      .sort();

    expect(procedures).toEqual(["create", "listByTenant", "reissuePassword"]);
  });
});
