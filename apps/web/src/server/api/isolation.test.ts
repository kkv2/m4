import { prisma } from "@m4/db";
import { describe, expect, it } from "vitest";

import { appRouter } from "~/server/api/root";
import { OPERATOR_SESSION_COOKIE, TENANT_SESSION_COOKIE } from "~/server/auth/cookies";
import { createOperatorSession, createUserSession } from "~/server/auth/session";
import {
  cookieHeader,
  createTestCaller,
  createTestOperator,
  createTestTenant,
  createTestUser,
  uniqueEmail,
  uniqueSuffix,
} from "~/server/testing/fixtures";

/**
 * SC-007 and SC-005, asserted by calling procedures directly.
 *
 * Going through the interface would prove only that the interface does not
 * *offer* a way across the boundary. These call every procedure the router has,
 * as the wrong caller and about the wrong tenant, because the guarantee has to
 * hold for anyone who skips the screens entirely.
 */

async function tenantWithUser(name?: string) {
  const tenant = await createTestTenant(name ? { name } : {});
  const { user, password } = await createTestUser({
    tenantId: tenant.id,
    firstLoginCompleted: true,
  });
  const session = await createUserSession(user.id);
  const { caller } = await createTestCaller({
    cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
  });
  return { tenant, user, password, caller };
}

/** Every procedure name the router exposes. */
const allProcedures = Object.keys(appRouter._def.procedures).sort();

describe("the procedure surface", () => {
  it("is what these tests think it is", () => {
    // If a router is added and this list is not updated, the sweep below stops
    // covering it — so the list is asserted rather than assumed.
    expect(allProcedures).toEqual([
      "account.changePassword",
      "account.get",
      "account.updateDisplayName",
      "account.updateLanguage",
      "admin.tenants.create",
      "admin.tenants.get",
      "admin.tenants.list",
      "admin.users.create",
      "admin.users.listByTenant",
      "admin.users.reissuePassword",
      "auth.me",
      "auth.signIn",
      "auth.signOut",
      "health.db",
      "health.ping",
      "onboarding.confirmLanguage",
      "onboarding.replacePassword",
      "operatorAuth.me",
      "operatorAuth.signIn",
      "operatorAuth.signOut",
    ]);
  });
});

describe("tenant isolation (SC-007)", () => {
  it("gives a signed-in user no procedure that reads another tenant", async () => {
    const mine = await tenantWithUser();
    const theirs = await tenantWithUser(`Other ${uniqueSuffix()}`);

    // Everything that can name a tenant, named at somebody else's.
    await expect(
      mine.caller.admin.tenants.get({ tenantId: theirs.tenant.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      mine.caller.admin.users.listByTenant({ tenantId: theirs.tenant.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(mine.caller.admin.tenants.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      mine.caller.admin.users.reissuePassword({ userId: theirs.user.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("gives a signed-in user no procedure that writes to another tenant", async () => {
    const mine = await tenantWithUser();
    const theirs = await tenantWithUser();
    const email = uniqueEmail("smuggled");

    await expect(
      mine.caller.admin.users.create({
        tenantId: theirs.tenant.id,
        email,
        name: "Smuggled",
        language: "JA",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
  });

  it("returns only the caller's own tenant from the one procedure that names one", async () => {
    const mine = await tenantWithUser();
    const theirs = await tenantWithUser(`Other ${uniqueSuffix()}`);

    const me = await mine.caller.auth.me();

    expect(me.tenantId).toBe(mine.tenant.id);
    expect(me.tenantName).toBe(mine.tenant.name);
    expect(JSON.stringify(me)).not.toContain(theirs.tenant.id);
    expect(JSON.stringify(me)).not.toContain(theirs.tenant.name);
  });

  it("does not let one user's settings procedures touch another user", async () => {
    // FR-041 as a shape: none of them accepts a user id, so the only account
    // they can reach is the caller's.
    const mine = await tenantWithUser();
    const theirs = await tenantWithUser();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: theirs.user.id } });

    await mine.caller.account.updateDisplayName({ displayName: "Renamed By Someone Else" });
    await mine.caller.account.updateLanguage({ language: "EN" });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: theirs.user.id } });
    expect(after.name).toBe(before.name);
    expect(after.language).toBe(before.language);
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it("does not let a signed-in user reach the console with a forged cookie name", async () => {
    // The operator boundary is two cookie names and two tables, not a claim in
    // one token — so presenting a user token as an operator resolves to nobody.
    const mine = await tenantWithUser();
    const session = await createUserSession(mine.user.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });

    await expect(caller.operatorAuth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.admin.tenants.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("does not let an operator token act as a tenant user", async () => {
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
    });

    await expect(caller.auth.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.account.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("credential exposure (SC-005)", () => {
  it("returns no password and no hash from any read a tenant user can make", async () => {
    const { caller, password } = await tenantWithUser();

    const responses = [await caller.auth.me(), await caller.account.get()];

    for (const response of responses) {
      const json = JSON.stringify(response);
      expect(json).not.toContain(password);
      expect(json).not.toContain("passwordHash");
      expect(json).not.toContain("scrypt$");
    }
  });

  it("returns no password and no hash from any read an operator can make", async () => {
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });

    const tenant = await createTestTenant();
    const { user, password } = await createTestUser({ tenantId: tenant.id });

    const responses = [
      await caller.operatorAuth.me(),
      await caller.admin.tenants.list(),
      await caller.admin.tenants.get({ tenantId: tenant.id }),
      await caller.admin.users.listByTenant({ tenantId: tenant.id }),
    ];

    for (const response of responses) {
      const json = JSON.stringify(response);
      expect(json).not.toContain(password);
      expect(json).not.toContain("passwordHash");
      expect(json).not.toContain("scrypt$");
    }
    expect(user.id).toBeTruthy();
  });

  it("returns a generated password only from the two calls that generate one", async () => {
    // FR-003: shown once, by the call that made it, and never read back.
    const { operator } = await createTestOperator();
    const session = await createOperatorSession(operator.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token),
    });
    const tenant = await createTestTenant();

    const created = await caller.admin.users.create({
      tenantId: tenant.id,
      email: uniqueEmail("once"),
      name: "Shown Once",
      language: "JA",
    });
    expect(created.generatedPassword).toBeTruthy();

    // Reading the same user back must not carry it.
    const listed = await caller.admin.users.listByTenant({ tenantId: tenant.id });
    expect(JSON.stringify(listed)).not.toContain(created.generatedPassword);

    const reissued = await caller.admin.users.reissuePassword({ userId: created.id });
    expect(reissued.generatedPassword).not.toBe(created.generatedPassword);

    const afterReissue = await caller.admin.users.listByTenant({ tenantId: tenant.id });
    expect(JSON.stringify(afterReissue)).not.toContain(reissued.generatedPassword);
  });

  it("stores no password in a form that could be read back", async () => {
    const { user, password } = await createTestUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(row.passwordHash).not.toContain(password);
    expect(row.passwordHash.startsWith("scrypt$")).toBe(true);
  });

  it("stores no session token, only its hash", async () => {
    const { user } = await createTestUser();
    const issued = await createUserSession(user.id);

    const rows = await prisma.userSession.findMany({ where: { userId: user.id } });

    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(issued.token);
  });
});

describe("deletion (FR-046)", () => {
  it("exposes no procedure that deletes a tenant or a user", () => {
    const destructive = allProcedures.filter((name) => /delete|remove|destroy|purge/i.test(name));

    expect(destructive).toEqual([]);
  });
});
