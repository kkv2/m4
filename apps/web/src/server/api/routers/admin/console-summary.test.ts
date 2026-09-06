import { describe, expect, it } from "vitest";

import { OPERATOR_SESSION_COOKIE, TENANT_SESSION_COOKIE } from "~/server/auth/cookies";
import { createOperatorSession, createUserSession } from "~/server/auth/session";
import {
  cookieHeader,
  createTestCaller,
  createTestOperator,
  uniqueEmail,
  uniqueSuffix,
} from "~/server/testing/fixtures";

/**
 * User Story 6: what the operator console reports is true.
 *
 * The other suites use fixtures that set the first-login markers directly,
 * which is right for testing a procedure in isolation. This one does not: it
 * registers real users and drives them through the real sign-in and onboarding
 * procedures, then reads the console. US6's value is not that the console can
 * render a number — it is that the number matches what actually happened.
 */

async function operatorCaller() {
  const { operator } = await createTestOperator();
  const session = await createOperatorSession(operator.id);
  return createTestCaller({ cookie: cookieHeader(OPERATOR_SESSION_COOKIE, session.token) });
}

/** A caller signed in as the given tenant user. */
async function callerFor(userId: string) {
  const session = await createUserSession(userId);
  return createTestCaller({ cookie: cookieHeader(TENANT_SESSION_COOKIE, session.token) });
}

/** Register a tenant with two users, exactly as an operator would. */
async function tenantWithTwoUsers() {
  const { caller: operator } = await operatorCaller();

  const { id: tenantId } = await operator.admin.tenants.create({
    name: `Summary ${uniqueSuffix()}`,
  });

  const first = await operator.admin.users.create({
    tenantId,
    email: uniqueEmail("first"),
    name: "First Person",
    language: "JA",
  });
  const second = await operator.admin.users.create({
    tenantId,
    email: uniqueEmail("second"),
    name: "Second Person",
    language: "JA",
  });

  return { operator, tenantId, first, second };
}

async function firstLoginStatuses(
  operator: Awaited<ReturnType<typeof operatorCaller>>["caller"],
  tenantId: string,
) {
  const users = await operator.admin.users.listByTenant({ tenantId });
  return users.map((user) => user.firstLoginCompletedAt !== null);
}

describe("the tenant summary", () => {
  it("counts the users that were actually registered", async () => {
    const { operator, tenantId } = await tenantWithTwoUsers();

    await expect(operator.admin.tenants.get({ tenantId })).resolves.toMatchObject({
      id: tenantId,
      userCount: 2,
    });
  });

  it("reports the chat count as zero, not null and not an error", async () => {
    const { operator, tenantId } = await tenantWithTwoUsers();

    const summary = await operator.admin.tenants.get({ tenantId });

    expect(summary.conversationCount).toBe(0);
    expect(summary.conversationCount).not.toBeNull();
  });

  it("reports the same numbers in the list as in the detail", async () => {
    const { operator, tenantId } = await tenantWithTwoUsers();

    const detail = await operator.admin.tenants.get({ tenantId });
    const listed = (await operator.admin.tenants.list()).find((t) => t.id === tenantId);

    expect(listed).toEqual(detail);
  });

  it("counts a third user as soon as one is registered", async () => {
    const { operator, tenantId } = await tenantWithTwoUsers();

    await operator.admin.users.create({
      tenantId,
      email: uniqueEmail("third"),
      name: "Third Person",
      language: "EN",
    });

    await expect(operator.admin.tenants.get({ tenantId })).resolves.toMatchObject({ userCount: 3 });
  });
});

describe("first-login status, driven through the real flow", () => {
  it("reads as not complete for a user who has never signed in", async () => {
    const { operator, tenantId } = await tenantWithTwoUsers();

    expect(await firstLoginStatuses(operator, tenantId)).toEqual([false, false]);
  });

  it("still reads as not complete after only the language step", async () => {
    // FR-033: first login is complete once *both* steps are done. Confirming a
    // language is not enough, and the console must not claim otherwise.
    const { operator, tenantId, first } = await tenantWithTwoUsers();
    const { caller: user } = await callerFor(first.id);

    await user.onboarding.confirmLanguage({ language: "JA" });

    expect(await firstLoginStatuses(operator, tenantId)).toEqual([false, false]);
  });

  it("flips for exactly the user who finished, once both steps are done", async () => {
    const { operator, tenantId, first, second } = await tenantWithTwoUsers();
    const { caller: user } = await callerFor(first.id);

    await user.onboarding.confirmLanguage({ language: "JA" });
    await user.onboarding.replacePassword({ newPassword: "gantry lucid pinecone" });

    const users = await operator.admin.users.listByTenant({ tenantId });
    const finished = users.filter((u) => u.firstLoginCompletedAt !== null);

    expect(finished).toHaveLength(1);
    expect(finished[0]?.id).toBe(first.id);
    expect(users.find((u) => u.id === second.id)?.firstLoginCompletedAt).toBeNull();
  });

  it("is the story's own independent test: two users, one completed", async () => {
    // "Register a tenant with two users, sign in as one of them, and confirm
    // the console reports two users and exactly one completed first login."
    const { operator, tenantId, first } = await tenantWithTwoUsers();

    const { caller: anonymous } = await createTestCaller();
    const users = await operator.admin.users.listByTenant({ tenantId });
    const target = users.find((u) => u.id === first.id);
    await anonymous.auth.signIn({
      email: target?.email ?? "",
      password: first.generatedPassword,
    });

    const { caller: signedIn } = await callerFor(first.id);
    await signedIn.onboarding.confirmLanguage({ language: "JA" });
    await signedIn.onboarding.replacePassword({ newPassword: "gantry lucid pinecone" });

    const summary = await operator.admin.tenants.get({ tenantId });
    expect(summary.userCount).toBe(2);
    expect((await firstLoginStatuses(operator, tenantId)).filter(Boolean)).toHaveLength(1);
  });

  it("is not undone by an operator reissuing that user's password", async () => {
    // FR-035. A reissue is a credential change, not a re-onboarding.
    const { operator, tenantId, first } = await tenantWithTwoUsers();
    const { caller: user } = await callerFor(first.id);
    await user.onboarding.confirmLanguage({ language: "JA" });
    await user.onboarding.replacePassword({ newPassword: "gantry lucid pinecone" });

    await operator.admin.users.reissuePassword({ userId: first.id });

    expect((await firstLoginStatuses(operator, tenantId)).filter(Boolean)).toHaveLength(1);
  });

  it("is not undone by the user changing their own password later", async () => {
    const { operator, tenantId, first } = await tenantWithTwoUsers();
    const { caller: user } = await callerFor(first.id);
    await user.onboarding.confirmLanguage({ language: "JA" });
    await user.onboarding.replacePassword({ newPassword: "gantry lucid pinecone" });

    const { caller: settled } = await callerFor(first.id);
    await settled.account.changePassword({
      currentPassword: "gantry lucid pinecone",
      newPassword: "ravine spindle almanac",
    });

    expect((await firstLoginStatuses(operator, tenantId)).filter(Boolean)).toHaveLength(1);
  });

  it("counts each tenant's completions separately", async () => {
    const alpha = await tenantWithTwoUsers();
    const beta = await tenantWithTwoUsers();

    const { caller: user } = await callerFor(alpha.first.id);
    await user.onboarding.confirmLanguage({ language: "JA" });
    await user.onboarding.replacePassword({ newPassword: "gantry lucid pinecone" });

    expect((await firstLoginStatuses(alpha.operator, alpha.tenantId)).filter(Boolean)).toHaveLength(
      1,
    );
    expect((await firstLoginStatuses(beta.operator, beta.tenantId)).filter(Boolean)).toHaveLength(
      0,
    );
  });
});
