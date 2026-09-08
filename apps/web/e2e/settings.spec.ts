import { expect, test } from "@playwright/test";

import {
  createOperator,
  dialog,
  newClientContext,
  registerTenant,
  registerUser,
  signInAndOnboard,
  signInAsOperator,
} from "./support";

/**
 * Settings, as the person who uses them reaches them.
 *
 * The screen used to be a route of its own, which meant arriving there and
 * finding no way back to the application — the shell it rendered in offered
 * none. It is a dialog now, so every test here is as much about leaving it as
 * about what it does.
 */

async function onboardedUser(browser: Parameters<typeof newClientContext>[0]) {
  const console_ = await (await newClientContext(browser)).newPage();
  await signInAsOperator(console_, await createOperator());
  await registerTenant(console_, { defaultLanguage: "JA" });
  const member = await registerUser(console_, { name: "山田 花子" });

  const app = await (await newClientContext(browser)).newPage();
  const credentials = await signInAndOnboard(app, member);

  return { app, credentials };
}

test("settings open over the application, and close back onto it", async ({ browser }) => {
  const { app } = await onboardedUser(browser);

  await expect(dialog(app)).toHaveCount(0);
  await app.getByRole("button", { name: "設定" }).click();
  await expect(dialog(app)).toHaveCount(1);
  // The application is still there behind it, not navigated away from.
  await expect(app).toHaveURL("/");

  await app.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog(app)).toHaveCount(0);
  await expect(app.getByRole("heading", { level: 1 })).toContainText("山田 花子");
});

test("the keyboard opens settings, and Escape and the scrim both close them", async ({
  browser,
}) => {
  const { app } = await onboardedUser(browser);

  /**
   * Retried, because a key press has no actionability check to wait behind: it
   * goes to whatever is listening at that instant, and the shortcut's listener
   * is installed by an effect that runs only once the shell has hydrated.
   */
  async function pressShortcut() {
    await expect(async () => {
      await app.keyboard.press("ControlOrMeta+Comma");
      await expect(dialog(app)).toHaveCount(1, { timeout: 500 });
    }).toPass();
  }

  await pressShortcut();

  await app.keyboard.press("Escape");
  await expect(dialog(app)).toHaveCount(0);

  await pressShortcut();
  // Top left of the viewport is scrim, never the panel, which is centred.
  await app.mouse.click(4, 4);
  await expect(dialog(app)).toHaveCount(0);
});

test("choosing a language moves the control that chose it, and the shell with it", async ({
  browser,
}) => {
  const { app } = await onboardedUser(browser);

  await app.getByRole("button", { name: "設定" }).click();
  const settings = dialog(app);
  await expect(settings.locator("select[name=language]")).toHaveValue("JA");

  await settings.locator("select[name=language]").selectOption("EN");

  // The bug this replaces: everything switched to English except the dropdown,
  // which kept showing the cached Japanese.
  await expect(settings.locator("select[name=language]")).toHaveValue("EN");
  await expect(settings.getByLabel("Display name")).toBeVisible();
  await expect(app.getByRole("button", { name: "Sign out" })).toBeVisible();

  // And it survives a reload, so it really was saved.
  await app.reload();
  await expect(app.getByRole("button", { name: "Settings" })).toBeVisible();
});

test("a mistyped confirmation is caught before the password is changed", async ({ browser }) => {
  const { app, credentials } = await onboardedUser(browser);

  await app.getByRole("button", { name: "設定" }).click();
  const settings = dialog(app);

  await settings.locator("input[name=currentPassword]").fill(credentials.password);
  await settings.locator("input[name=newPassword]").fill("harbour thimble ledger");
  await settings.locator("input[name=confirmPassword]").fill("harbour thimble ledgar");

  await expect(settings.locator("p[role=alert]")).toHaveText("新しいパスワードが一致しません。");
  await expect(settings.getByRole("button", { name: "パスワードを変更" })).toBeDisabled();

  await settings.locator("input[name=confirmPassword]").fill("harbour thimble ledger");
  await settings.getByRole("button", { name: "パスワードを変更" }).click();
  await expect(settings.locator("p[role=status]")).toHaveText("変更を保存しました。");
});

test("the mark carries the user back to the application's own home", async ({ browser }) => {
  const { app } = await onboardedUser(browser);

  await expect(app.getByText("ユーザーコンソール")).toBeVisible();
  await app.getByRole("img", { name: "M4" }).click();

  await expect(app).toHaveURL("/");
});
