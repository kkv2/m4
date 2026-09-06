import { expect, test } from "@playwright/test";

/**
 * The root is the tenant application, not a marketing page. Everything behind
 * it needs an account, so what an anonymous visitor should see is the sign-in
 * screen — and nothing else.
 */
test("the root sends an anonymous visitor to sign in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ログイン");
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByLabel("パスワード")).toBeVisible();
});

test("the sign-in screen offers English, and remembers the choice", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "English" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");

  await page.reload();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
});

test("the operator console is a separate surface, and is Japanese only", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("運営コンソールにログイン");
  await expect(page.getByRole("button", { name: "English" })).toHaveCount(0);
});
