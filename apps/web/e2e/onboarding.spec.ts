import { expect, test } from "@playwright/test";

import {
  errorAlert,
  createOperator,
  firstLoginCell,
  newClientContext,
  registerTenant,
  registerUser,
  signInAsOperator,
} from "./support";

/**
 * The whole onboarding chain, in a browser: US1 → US3 → US4 → US6.
 *
 * This is the one spec that proves the pieces fit together. Each issue's own
 * tests prove its procedures behave; this proves an operator can create a
 * customer and that customer's first person can get in.
 */

test("an operator creates a customer, and their first person signs in", async ({ browser }) => {
  const operatorContext = await newClientContext(browser);
  const console_ = await operatorContext.newPage();

  // US1: the account exists only because the CLI made it.
  const operator = await createOperator();
  await signInAsOperator(console_, operator);
  await expect(console_.getByText(operator.email)).toBeVisible();

  // US3: register a tenant and a user, and capture the credential shown once.
  const tenant = await registerTenant(console_, { defaultLanguage: "EN" });
  await expect(console_.locator("select[name=language]")).toHaveValue("EN");
  const member = await registerUser(console_, { name: "Member One" });

  // US6: the console reports the user as not having finished.
  await expect(firstLoginCell(console_, member.email)).toHaveText("未完了");

  // US4: the person signs in with what they were handed.
  const memberContext = await newClientContext(browser);
  const app = await memberContext.newPage();
  await app.goto("/");
  await expect(app).toHaveURL(/\/sign-in$/);
  await app.getByLabel("メールアドレス").fill(member.email);
  await app.getByLabel("パスワード").fill(member.password);
  await app.getByRole("button", { name: "ログイン" }).click();

  // The language step, with the operator's choice pre-selected.
  await app.waitForURL("**/welcome");
  await expect(app.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  await expect(app.locator("select[name=language]")).toHaveValue("EN");

  // Confirming in Japanese switches the copy for the step that follows.
  await app.locator("select[name=language]").selectOption("JA");
  await app.getByRole("button", { name: "次へ" }).click();
  await expect(app.getByRole("heading", { name: "パスワードを変更してください" })).toBeVisible();

  await app.locator("input[name=newPassword]").fill("marigold trellis cadence");
  await app.getByRole("button", { name: "設定して開始" }).click();
  await app.waitForURL("/");
  await expect(app.getByRole("heading", { level: 1 })).toContainText("Member One");

  // SC-009: the issued password is dead.
  await app.getByRole("button", { name: "ログアウト" }).click();
  await app.waitForURL("**/sign-in");
  await app.getByLabel("メールアドレス").fill(member.email);
  await app.getByLabel("パスワード").fill(member.password);
  await app.getByRole("button", { name: "ログイン" }).click();
  await expect(errorAlert(app)).toHaveText("メールアドレスまたはパスワードが正しくありません。");

  // The replaced one works, and the first-login steps do not come back.
  await app.getByLabel("パスワード").fill("marigold trellis cadence");
  await app.getByRole("button", { name: "ログイン" }).click();
  await app.waitForURL("/");
  await expect(app.getByRole("heading", { level: 1 })).toContainText("Member One");

  // SC-006: the console reflects it — by navigating back into the tenant, which
  // is what an operator does. A reload would also work, and used to be the only
  // thing that did: the console's reads were being served from a 30-second
  // cache, so the screen that exists to answer "has this landed yet?" could
  // answer with a stale no.
  await console_.getByRole("link", { name: "テナント一覧へ戻る" }).click();
  await console_.waitForURL("**/admin");
  await console_
    .getByRole("row")
    .filter({ hasText: tenant.name })
    .getByRole("link", { name: "詳細" })
    .click();
  await console_.waitForURL("**/admin/tenants/**");
  await expect(firstLoginCell(console_, member.email)).toHaveText("完了");
});

test("the first-login steps are resumable, and cannot be skipped", async ({ browser }) => {
  const operatorContext = await newClientContext(browser);
  const console_ = await operatorContext.newPage();
  const operator = await createOperator();
  await signInAsOperator(console_, operator);
  await registerTenant(console_);
  const member = await registerUser(console_);

  const memberContext = await newClientContext(browser);
  const app = await memberContext.newPage();
  await app.goto("/sign-in");
  await app.getByLabel("メールアドレス").fill(member.email);
  await app.getByLabel("パスワード").fill(member.password);
  await app.getByRole("button", { name: "ログイン" }).click();
  await app.waitForURL("**/welcome");

  // FR-034: the application is closed until both steps are done.
  await app.goto("/");
  await expect(app).toHaveURL(/\/welcome$/);
  await app.goto("/settings");
  await expect(app).toHaveURL(/\/welcome$/);

  // Abandon after the language step, then come back.
  await app.getByRole("button", { name: "次へ" }).click();
  await expect(app.getByRole("heading", { name: "パスワードを変更してください" })).toBeVisible();
  await app.goto("/");
  await expect(app).toHaveURL(/\/welcome$/);
  await expect(app.getByRole("heading", { name: "パスワードを変更してください" })).toBeVisible();

  // FR-032: each rule refuses by name.
  const refusals: [string, string][] = [
    [member.password, "配布されたパスワードとは異なるものにしてください。"],
    ["short", "パスワードは 12 文字以上にしてください。"],
    ["passwordpassword", "よく使われるパスワードです。推測されにくいものにしてください。"],
    [member.email, "メールアドレスと同じパスワードは使用できません。"],
  ];
  for (const [attempt, message] of refusals) {
    await app.locator("input[name=newPassword]").fill(attempt);
    await app.getByRole("button", { name: "設定して開始" }).click();
    await expect(errorAlert(app)).toHaveText(message);
  }

  await app.locator("input[name=newPassword]").fill("marigold trellis cadence");
  await app.getByRole("button", { name: "設定して開始" }).click();
  await app.waitForURL("/");
});

test("the sign-in screen remembers the language chosen on that device", async ({ page }) => {
  // FR-043a, FR-043b, FR-043d.
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ログイン");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");

  await page.getByRole("button", { name: "日本語" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ログイン");
});
