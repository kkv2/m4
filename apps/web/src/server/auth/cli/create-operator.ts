// Must come first. It loads the single .env at the workspace root, and
// @m4/db builds its PrismaClient at import time from DATABASE_URL — Next.js
// does this for the app, but a CLI run by tsx has nobody else to do it.
import "~/env/server";

import { fileURLToPath } from "node:url";

import { Prisma, prisma } from "@m4/db";
import { z } from "zod";

import { generatePassword, hashPassword } from "~/server/auth/password";

/**
 * The only way a SaaS operator account comes into existence (FR-001).
 *
 * FR-004 forbids any screen or network-facing endpoint that creates one, so
 * this deliberately lives outside the router tree. It is under `src/server/`
 * rather than in a scripts directory because it must share
 * `~/server/auth/password` with the application: duplicating the hashing
 * parameters is how you end up with an account nobody can sign in to.
 */

const emailSchema = z.string().trim().toLowerCase().email();

export type CreateOperatorFailure =
  { reason: "invalid-email" } | { reason: "already-exists"; email: string };

export class CreateOperatorError extends Error {
  constructor(readonly failure: CreateOperatorFailure) {
    super(
      failure.reason === "invalid-email"
        ? "That is not a valid email address."
        : `An operator account already exists for ${failure.email}.`,
    );
    this.name = "CreateOperatorError";
  }
}

export interface CreatedOperator {
  id: string;
  email: string;
  /**
   * The generated password, in plaintext. Returned here and nowhere else: it is
   * never stored, never logged, and cannot be read back (FR-002, FR-003).
   */
  password: string;
}

/**
 * Create one operator account. Throws `CreateOperatorError` when the address is
 * malformed or already taken (FR-005); no account is created in either case.
 */
export async function createOperator(rawEmail: string): Promise<CreatedOperator> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    throw new CreateOperatorError({ reason: "invalid-email" });
  }
  const email = parsed.data;

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  try {
    const operator = await prisma.operator.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });
    return { ...operator, password };
  } catch (error) {
    // P2002 is the unique constraint on email. Catching it rather than checking
    // first means two concurrent runs cannot both succeed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CreateOperatorError({ reason: "already-exists", email });
    }
    throw error;
  }
}

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const processIo: CliIo = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

const USAGE = "Usage: pnpm operator:create -- <email>";

/**
 * Argv handling, kept separate from `createOperator` so each can be tested
 * without the other. Returns the process exit code rather than calling
 * `process.exit`, which a test cannot survive.
 */
export async function runCreateOperatorCli(args: string[], io: CliIo = processIo): Promise<number> {
  // `pnpm operator:create -- <email>` forwards the separator through both the
  // root script and the workspace filter, so it arrives as a literal argument.
  const [email, ...rest] = args.filter((arg) => arg !== "--");

  if (!email || rest.length > 0) {
    io.err(USAGE);
    return 2;
  }

  try {
    const operator = await createOperator(email);

    io.out("Operator account created.");
    io.out("");
    io.out(`  Email:    ${operator.email}`);
    io.out(`  Password: ${operator.password}`);
    io.out("");
    io.out("This password is shown once and cannot be read back. Copy it now.");
    return 0;
  } catch (error) {
    if (error instanceof CreateOperatorError) {
      io.err(error.message);
      return 1;
    }
    io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/**
 * Only run when this module is the entry point, so importing it from a test
 * does not create an account as a side effect.
 */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = await runCreateOperatorCli(process.argv.slice(2));
  await prisma.$disconnect();
  process.exit(code);
}
