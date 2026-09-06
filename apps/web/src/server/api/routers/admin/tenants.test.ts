import { Language, prisma } from "@m4/db";
import { describe, expect, it } from "vitest";

import { OPERATOR_SESSION_COOKIE, TENANT_SESSION_COOKIE } from "~/server/auth/cookies";
import { createOperatorSession, createUserSession } from "~/server/auth/session";
import {
  cookieHeader,
  createTestCaller,
  createTestOperator,
  createTestTenant,
  createTestUser,
  uniqueSuffix,
} from "~/server/testing/fixtures";

/** A caller signed in as a freshly created operator. */
async function operatorCaller() {
  const { operator } = await createTestOperator();
  const session = await createOperatorSession(operator.id);
  return createTestCaller({ cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token) });
}

describe("admin.tenants.create", () => {
  it("registers a tenant and returns its identifier", async () => {
    const { caller } = await operatorCaller();
    const name = `Acme ${uniqueSuffix()}`;

    const { id } = await caller.admin.tenants.create({ name, defaultLanguage: Language.EN });
    const row = await prisma.tenant.findUnique({ where: { id } });

    expect(row?.name).toBe(name);
    expect(row?.defaultLanguage).toBe(Language.EN);
  });

  it("defaults the language to Japanese", async () => {
    const { caller } = await operatorCaller();

    const { id } = await caller.admin.tenants.create({ name: `Acme ${uniqueSuffix()}` });
    const row = await prisma.tenant.findUnique({ where: { id } });

    expect(row?.defaultLanguage).toBe(Language.JA);
  });

  it("refuses an empty display name, and one that is only whitespace", async () => {
    const { caller } = await operatorCaller();

    await expect(caller.admin.tenants.create({ name: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.admin.tenants.create({ name: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("trims the display name rather than storing the padding", async () => {
    const { caller } = await operatorCaller();
    const name = `Padded ${uniqueSuffix()}`;

    const { id } = await caller.admin.tenants.create({ name: `   ${name}   ` });

    await expect(
      prisma.tenant.findUnique({ where: { id }, select: { name: true } }),
    ).resolves.toEqual({ name });
  });

  it("allows two tenants to share a display name, because the identifier tells them apart", async () => {
    const { caller } = await operatorCaller();
    const name = `Shared ${uniqueSuffix()}`;

    const first = await caller.admin.tenants.create({ name });
    const second = await caller.admin.tenants.create({ name });

    expect(first.id).not.toBe(second.id);
  });
});

describe("admin.tenants.get", () => {
  it("reports the identifier and both counts", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant({ name: `Counted ${uniqueSuffix()}` });
    await createTestUser({ tenantId: tenant.id });
    await createTestUser({ tenantId: tenant.id });

    const summary = await caller.admin.tenants.get({ tenantId: tenant.id });

    expect(summary.id).toBe(tenant.id);
    expect(summary.userCount).toBe(2);
    expect(summary.conversationCount).toBe(0);
  });

  it("reports zero chats rather than null while the chat feature does not exist", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();

    const summary = await caller.admin.tenants.get({ tenantId: tenant.id });

    expect(summary.conversationCount).toBe(0);
    expect(summary.userCount).toBe(0);
  });

  it("counts only its own tenant's users", async () => {
    const { caller } = await operatorCaller();
    const mine = await createTestTenant();
    const theirs = await createTestTenant();
    await createTestUser({ tenantId: mine.id });
    await createTestUser({ tenantId: theirs.id });
    await createTestUser({ tenantId: theirs.id });

    await expect(caller.admin.tenants.get({ tenantId: mine.id })).resolves.toMatchObject({
      userCount: 1,
    });
    await expect(caller.admin.tenants.get({ tenantId: theirs.id })).resolves.toMatchObject({
      userCount: 2,
    });
  });

  it("is a not-found for an unknown tenant, not an empty summary", async () => {
    const { caller } = await operatorCaller();

    await expect(
      caller.admin.tenants.get({ tenantId: "clzzzzzzzzzzzzzzzzzzzzzzz" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects an identifier that is not a cuid before it reaches the database", async () => {
    const { caller } = await operatorCaller();

    await expect(caller.admin.tenants.get({ tenantId: "../../etc/passwd" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("admin.tenants.list", () => {
  it("includes a newly registered tenant, newest first", async () => {
    const { caller } = await operatorCaller();
    const name = `Listed ${uniqueSuffix()}`;

    const { id } = await caller.admin.tenants.create({ name });
    const list = await caller.admin.tenants.list();

    expect(list[0]?.id).toBe(id);
    expect(list.find((t) => t.id === id)?.name).toBe(name);
  });

  it("carries the same counts as get", async () => {
    const { caller } = await operatorCaller();
    const tenant = await createTestTenant();
    await createTestUser({ tenantId: tenant.id });

    const list = await caller.admin.tenants.list();
    const row = list.find((t) => t.id === tenant.id);

    expect(row?.userCount).toBe(1);
    expect(row?.conversationCount).toBe(0);
  });
});

describe("who may reach these procedures", () => {
  it("refuses an anonymous caller without disclosing tenant data", async () => {
    const { caller } = await createTestCaller();

    await expect(caller.admin.tenants.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.admin.tenants.create({ name: "Should not exist" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("refuses a signed-in tenant user", async () => {
    const { user } = await createTestUser({ firstLoginCompleted: true });
    const session = await createUserSession(user.id);
    const { caller } = await createTestCaller({
      cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token),
    });

    await expect(caller.admin.tenants.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates nothing when it refuses", async () => {
    const name = `Refused ${uniqueSuffix()}`;
    const { caller } = await createTestCaller();

    await expect(caller.admin.tenants.create({ name })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await expect(prisma.tenant.count({ where: { name } })).resolves.toBe(0);
  });
});
