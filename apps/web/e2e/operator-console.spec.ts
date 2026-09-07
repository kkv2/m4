import { expect, test } from "@playwright/test";

import {
  errorAlert,
  createOperator,
  registerTenant,
  registerUser,
  signInAsOperator,
  newClientContext,
  unique,
  uniqueEmail,
} from "./support";

/**
 * The operator console's registration paths, including the refusals — US2 and
 * US3 as an operator actually drives them.
 */

test("the console is closed to anyone not signed in", async ({ browser }) => {
  const page = await (await newClientContext(browser)).newPage();
  // FR-007: redirected, and no tenant data on the way past.
  for (const path of ["/admin", "/admin/tenants/clzzzzzzzzzzzzzzzzzzzzzzz"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/sign-in$/);
  }

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("運営コンソールにログイン");
  // FR-006: Japanese only, with no language control anywhere on it.
  await expect(page.getByRole("button", { name: "English" })).toHaveCount(0);
});

test("a wrong password is refused without revealing whether the address exists", async ({
  browser,
}) => {
  const page = await (await newClientContext(browser)).newPage();
  const operator = await createOperator();

  await page.goto("/admin/sign-in");
  await page.getByLabel("メールアドレス").fill(operator.email);
  await page.getByLabel("パスワード").fill("definitely-not-it");
  await page.getByRole("button", { name: "ログイン" }).click();
  const wrongPassword = await errorAlert(page).textContent();

  await page.getByLabel("メールアドレス").fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "ログイン" }).click();
  const unknownAddress = await errorAlert(page).textContent();

  expect(wrongPassword).toBe("メールアドレスまたはパスワードが正しくありません。");
  expect(unknownAddress).toBe(wrongPassword);
});

test("registering a tenant: Japanese by default, and a name is required", async ({ browser }) => {
  const page = await (await newClientContext(browser)).newPage();
  const operator = await createOperator();
  await signInAsOperator(page, operator);

  // FR-011: the field starts on Japanese.
  await expect(page.locator("select[name=defaultLanguage]")).toHaveValue("JA");

  // US2 scenario 3: an empty name is refused, and nothing is created.
  await page.getByRole("button", { name: "登録" }).click();
  await expect(errorAlert(page)).toHaveText("表示名を入力してください。");

  const name = unique("株式会社");
  await page.locator("input[name=name]").fill(name);
  await page.getByRole("button", { name: "登録" }).click();

  // FR-012, FR-013: identifier and both counts.
  const row = page.getByRole("row").filter({ hasText: name });
  await row.waitFor();
  await expect(row.getByRole("cell").nth(1)).toHaveText(/^c[a-z0-9]{20,}$/);
  await expect(row.getByRole("cell").nth(2)).toHaveText("日本語");
  await expect(row.getByRole("cell").nth(3)).toHaveText("0");
  // FR-014: zero chats, as a number rather than a blank.
  await expect(row.getByRole("cell").nth(4)).toHaveText("0");
});

test("the user form takes the tenant's default language, per tenant", async ({ browser }) => {
  const page = await (await newClientContext(browser)).newPage();
  const operator = await createOperator();
  await signInAsOperator(page, operator);

  // US3 scenario 1.
  await registerTenant(page, { defaultLanguage: "JA" });
  await expect(page.locator("select[name=language]")).toHaveValue("JA");

  // US3 scenario 2 — and reached by navigating between tenants, not by a fresh
  // load, which is the case that would carry the previous tenant's default.
  await registerTenant(page, { defaultLanguage: "EN" });
  await expect(page.locator("select[name=language]")).toHaveValue("EN");
});

test("an address already in use is refused, without naming the tenant that holds it", async ({
  browser,
}) => {
  const page = await (await newClientContext(browser)).newPage();
  const operator = await createOperator();
  await signInAsOperator(page, operator);

  const holder = unique("先客");
  await registerTenant(page, { name: holder });
  const taken = await registerUser(page);

  // A different tenant, the same address. FR-019.
  await registerTenant(page);
  await page.locator("input[name=email]").fill(taken.email);
  await page.locator("input[name=name]").fill("Duplicate");
  await page.getByRole("button", { name: "登録" }).click();

  const alert = errorAlert(page);
  await expect(alert).toHaveText("このメールアドレスは既に使用されています。");
  await expect(alert).not.toContainText(holder);
});

test("the user list shows the identifier and an immutable address", async ({ browser }) => {
  const page = await (await newClientContext(browser)).newPage();
  const operator = await createOperator();
  await signInAsOperator(page, operator);
  await registerTenant(page);
  const member = await registerUser(page, { name: "山田 花子" });

  const row = page.getByRole("row").filter({ hasText: member.email });
  await expect(row.getByRole("cell").nth(0)).toHaveText("山田 花子");
  await expect(row.getByRole("cell").nth(2)).toHaveText(/^c[a-z0-9]{20,}$/);
  await expect(row.getByRole("cell").nth(4)).toHaveText("未完了");
  // FR-018: shown as a value, never as something to type into.
  await expect(row.getByRole("textbox")).toHaveCount(0);
});

test("a reissued password replaces the old one, shown once", async ({ browser }) => {
  const page = await (await newClientContext(browser)).newPage();
  const operator = await createOperator();
  await signInAsOperator(page, operator);
  await registerTenant(page);
  const member = await registerUser(page);

  const row = page.getByRole("row").filter({ hasText: member.email });
  await row.getByRole("button", { name: "パスワードを再発行" }).click();

  const notice = page.getByRole("alert", { name: "パスワードを控えてください" });
  await notice.waitFor();
  const reissued = /パスワード([A-Za-z0-9]{20,})/.exec((await notice.textContent()) ?? "")?.[1];
  expect(reissued).toBeDefined();
  expect(reissued).not.toBe(member.password);

  // FR-003: dismissing it is final.
  await page.getByRole("button", { name: "控えました" }).click();
  await expect(page.getByText(reissued ?? "")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(reissued ?? "")).toHaveCount(0);

  // FR-035: reissue is a credential change, not a re-onboarding.
  await expect(row.getByRole("cell").nth(4)).toHaveText("未完了");
});

test("an empty tenant says so rather than showing a broken table", async ({ browser }) => {
  const page = await (await newClientContext(browser)).newPage();
  const operator = await createOperator();
  await signInAsOperator(page, operator);
  await registerTenant(page);

  await expect(page.getByText("このテナントにはまだユーザーがいません。")).toBeVisible();
});
