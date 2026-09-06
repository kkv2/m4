import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The server boundary, as an assertion rather than a convention.
 *
 * `CLAUDE.md` states that server-only code stays under `src/server/` and must
 * never reach a Client Component. Until now nothing checked it: a Client
 * Component that imported `@m4/db` passed lint, typecheck and every test, and
 * only `pnpm build` failed — and then only because Prisma happens to be
 * un-bundleable. An import of a *lighter* server module, like the cookie
 * helpers, would have crossed the boundary silently.
 */

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "generated" ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const clientComponents = sourceFiles(SRC)
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .map((file) => ({ file, source: readFileSync(file, "utf8") }))
  .filter(({ source }) => /^\s*["']use client["']/m.test(source));

/**
 * Type-only imports are erased at compile time and never reach the browser, so
 * they do not cross the boundary. `~/lib/trpc-client` legitimately imports the
 * `AppRouter` type from the server — that is how tRPC gives the client its
 * types, and no server code travels with it.
 */
function importsAtRuntime(source: string, modulePattern: RegExp): boolean {
  const statements = source.match(/import[\s\S]*?from\s+["'][^"']+["']/g) ?? [];

  return statements.some((statement) => {
    if (!modulePattern.test(statement)) return false;
    if (/^import\s+type\b/.test(statement)) return false;

    const braces = /\{([\s\S]*)\}/.exec(statement);
    if (!braces?.[1]) return true;

    // `import { type A, type B } from ...` is erased too.
    return braces[1]
      .split(",")
      .map((specifier) => specifier.trim())
      .filter((specifier) => specifier.length > 0)
      .some((specifier) => !specifier.startsWith("type "));
  });
}

const FORBIDDEN = [
  { pattern: /["']~\/server\//, what: "~/server/" },
  { pattern: /["']@m4\/db["']/, what: "@m4/db" },
];

describe("Client Components", () => {
  it("exist, so this test is checking something", () => {
    expect(clientComponents.length).toBeGreaterThan(3);
  });

  it.each(FORBIDDEN)("never import $what", ({ pattern, what }) => {
    const offenders = clientComponents
      .filter(({ source }) => importsAtRuntime(source, pattern))
      .map(({ file }) => path.relative(SRC, file));

    expect(
      offenders,
      `${what} must not reach the browser; move the shared part to src/lib/`,
    ).toEqual([]);
  });
});
