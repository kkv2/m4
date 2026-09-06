import { randomBytes } from "node:crypto";

import { Language, type Operator, type Tenant, type User, prisma } from "@m4/db";

import { createTRPCContext } from "~/server/api/context";
import { createCaller } from "~/server/api/root";
import { hashPassword } from "~/server/auth/password";

/**
 * Fixtures for database-backed tests.
 *
 * Test files run in parallel against one database, so nothing here truncates a
 * table or assumes an empty one. Every fixture carries a random suffix and each
 * test asserts only on rows it created.
 */

export function uniqueSuffix(): string {
  return randomBytes(8).toString("hex");
}

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${uniqueSuffix()}@example.test`;
}

export async function createTestTenant(
  overrides: Partial<Pick<Tenant, "name" | "defaultLanguage">> = {},
): Promise<Tenant> {
  return prisma.tenant.create({
    data: {
      name: overrides.name ?? `Tenant ${uniqueSuffix()}`,
      defaultLanguage: overrides.defaultLanguage ?? Language.JA,
    },
  });
}

export interface TestUserOptions {
  tenantId?: string;
  email?: string;
  name?: string;
  password?: string;
  language?: Language;
  firstLoginCompleted?: boolean;
}

export interface TestUser {
  user: User;
  /** The plaintext password the fixture used, for sign-in assertions. */
  password: string;
}

export async function createTestUser(options: TestUserOptions = {}): Promise<TestUser> {
  const tenantId = options.tenantId ?? (await createTestTenant()).id;
  const password = options.password ?? `fixture-${uniqueSuffix()}-passphrase`;
  const completed = options.firstLoginCompleted ?? false;

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: options.email ?? uniqueEmail(),
      name: options.name ?? "Test User",
      passwordHash: await hashPassword(password),
      language: options.language ?? Language.JA,
      languageConfirmedAt: completed ? new Date() : null,
      mustChangePassword: !completed,
      firstLoginCompletedAt: completed ? new Date() : null,
    },
  });

  return { user, password };
}

export interface TestOperator {
  operator: Operator;
  password: string;
}

export async function createTestOperator(email?: string): Promise<TestOperator> {
  const password = `fixture-${uniqueSuffix()}-passphrase`;

  const operator = await prisma.operator.create({
    data: {
      email: email ?? uniqueEmail("ops"),
      passwordHash: await hashPassword(password),
    },
  });

  return { operator, password };
}

/**
 * Callers for router tests.
 *
 * Procedures are exercised through `createCaller` rather than through the UI:
 * the acceptance scenarios are statements about procedures, and the properties
 * that matter most — tenant isolation, the operator boundary — must hold even
 * when nobody is driving a screen.
 */

export interface CallerOptions {
  /** Cookie header to present, as `name=value` pairs. */
  cookie?: string;
  /** The calling client, for throttling. Defaults to a unique address so that
   *  tests running in parallel do not trip each other's client counter. */
  client?: string;
}

export interface TestCaller {
  caller: ReturnType<typeof createCaller>;
  resHeaders: Headers;
}

export async function createTestCaller(options: CallerOptions = {}): Promise<TestCaller> {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", options.cookie);
  headers.set("x-forwarded-for", options.client ?? `192.0.2.${uniqueSuffix()}`);

  const resHeaders = new Headers();
  const context = await createTRPCContext({ headers, resHeaders });

  return { caller: createCaller(context), resHeaders };
}

/** Every Set-Cookie value a call emitted. */
export function setCookieValues(resHeaders: Headers): string[] {
  return resHeaders.getSetCookie();
}

/** A Cookie request header carrying one cookie. */
export function cookieHeader(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}`;
}
