import { randomBytes } from "node:crypto";

import { Language, type Operator, type Tenant, type User, prisma } from "@m4/db";

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
