import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Browser, BrowserContext, Page } from "@playwright/test";

const run = promisify(execFile);

/** Unique per call, so specs running in parallel never collide. */
export function unique(prefix = "e2e"): string {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${unique(prefix)}@example.test`;
}

/**
 * A browser context that the server sees as its own client.
 *
 * Sign-in throttling counts failures per calling client as well as per account
 * (FR-022a). Every spec here runs from one machine, so without this they share
 * a counter and a couple of deliberate wrong passwords lock the rest of the
 * suite out — which is the protection working, not a bug. Distinct addresses
 * are also the truthful model: these are different people.
 */
export async function newClientContext(browser: Browser): Promise<BrowserContext> {
  const octet = () => 1 + Math.floor(Math.random() * 254);
  return browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${octet()}.${octet()}` },
  });
}

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Bootstrap an operator the only way there is one — the CLI (FR-001, FR-004).
 *
 * This is US1 exercised for real rather than seeded around: if the command
 * stops printing a usable password, these specs stop being able to sign in.
 */
export async function createOperator(): Promise<Credentials> {
  const email = uniqueEmail("ops");
  const { stdout } = await run("pnpm", ["operator:create", "--", email], {
    cwd: process.cwd(),
  });

  const password = /Password:\s+(\S+)/.exec(stdout)?.[1];
  if (!password) {
    throw new Error(`the CLI printed no password:\n${stdout}`);
  }

  return { email, password };
}

export async function signInAsOperator(page: Page, operator: Credentials): Promise<void> {
  await page.goto("/admin");
  await page.getByLabel("メールアドレス").fill(operator.email);
  await page.getByLabel("パスワード").fill(operator.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("**/admin");
}

/** Register a tenant from the console and open its detail screen. */
export async function registerTenant(
  page: Page,
  options: { name?: string; defaultLanguage?: "JA" | "EN" } = {},
): Promise<{ name: string }> {
  const name = options.name ?? unique("テナント");

  await page.goto("/admin");
  await page.locator("input[name=name]").fill(name);
  if (options.defaultLanguage) {
    await page.locator("select[name=defaultLanguage]").selectOption(options.defaultLanguage);
  }
  await page.getByRole("button", { name: "登録" }).click();

  const row = page.getByRole("row").filter({ hasText: name });
  await row.waitFor();
  await row.getByRole("link", { name: "詳細" }).click();
  await page.waitForURL("**/admin/tenants/**");
  // The language field is empty until the tenant loads.
  await page.waitForFunction(() =>
    Boolean(document.querySelector<HTMLSelectElement>("select[name=language]")?.value),
  );

  return { name };
}

/**
 * Register a user on the open tenant detail screen and return the password the
 * console showed once. Dismisses the notice afterwards, as an operator would.
 */
export async function registerUser(
  page: Page,
  options: { email?: string; name?: string } = {},
): Promise<Credentials> {
  const email = options.email ?? uniqueEmail("member");

  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=name]").fill(options.name ?? "Member One");
  await page.getByRole("button", { name: "登録" }).click();

  const notice = page.getByRole("alert", { name: "パスワードを控えてください" });
  await notice.waitFor();
  const password = /パスワード([A-Za-z0-9]{20,})/.exec((await notice.textContent()) ?? "")?.[1];
  if (!password) {
    throw new Error("the console did not show a generated password");
  }
  await page.getByRole("button", { name: "控えました" }).click();

  return { email, password };
}

/**
 * The page's own error message.
 *
 * Not `getByRole("alert")`: Next.js's route announcer is also `role="alert"`,
 * so that matches two elements and fails strict mode.
 */
export function errorAlert(page: Page) {
  return page.locator("p[role=alert]");
}

/**
 * The cell where the console reports one user's first-login status.
 *
 * Returned as a locator rather than a string so callers assert with Playwright's
 * retrying `expect`. The console shows the last known value while it refetches,
 * which is the right behaviour — no flash of empty — but means a single read
 * can catch the previous answer.
 */
export function firstLoginCell(page: Page, email: string) {
  return page.getByRole("row").filter({ hasText: email }).getByRole("cell").nth(4);
}
