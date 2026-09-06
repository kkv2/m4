import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * User Story 7, as a property of the route tree rather than of one screen.
 *
 * The story says "any console screen" and "any application screen", which is a
 * statement about coverage: it is satisfied by the shells, and broken by a
 * screen that sits outside one. The first-login screen was exactly that — it
 * renders to a signed-in user, has no shell above it, and showed neither the
 * mark nor whose account was being set up.
 *
 * Asserting it per component would have missed that, because each component was
 * fine on its own. So this walks the routes instead.
 */

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)));

interface Route {
  /** Path relative to src/app, e.g. "(tenant)/(signed-in)/settings/page.tsx". */
  file: string;
  source: string;
  /** The nearest layout above it, if any. */
  shell: string | null;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "api" ? [] : walk(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

function nearestLayout(pageFile: string): string | null {
  let dir = path.dirname(pageFile);
  while (dir.startsWith(APP) && dir !== APP) {
    const candidate = path.join(dir, "layout.tsx");
    try {
      return readFileSync(candidate, "utf8") && candidate;
    } catch {
      dir = path.dirname(dir);
    }
  }
  return null;
}

const routes: Route[] = walk(APP).map((file) => {
  const shell = nearestLayout(file);
  return {
    file: path.relative(APP, file),
    source: readFileSync(file, "utf8") + (shell ? readFileSync(shell, "utf8") : ""),
    shell: shell ? path.relative(APP, shell) : null,
  };
});

/** Screens reached only by someone who is not signed in. */
const ANONYMOUS = ["(tenant)/(anonymous)/", "(operator)/(anonymous)/"];

const signedInRoutes = routes.filter(
  (route) => !ANONYMOUS.some((prefix) => route.file.startsWith(prefix)),
);

describe("the route tree", () => {
  it("has routes to check, and separates the signed-in ones", () => {
    expect(routes.length).toBeGreaterThan(4);
    expect(signedInRoutes.length).toBeGreaterThan(2);
    expect(signedInRoutes.length).toBeLessThan(routes.length);
  });
});

describe("every screen", () => {
  it.each(routes.map((route) => route.file))("shows the M4 mark: %s", (file) => {
    // FR-044. Anonymous screens carry it directly; signed-in ones inherit it
    // from their shell.
    const route = routes.find((candidate) => candidate.file === file);

    expect(route?.source, `${file} renders no <Mark />`).toMatch(/<Mark[\s/>]/);
  });
});

describe("every screen shown to a signed-in person", () => {
  it.each(signedInRoutes.map((route) => route.file))("says whose account it is: %s", (file) => {
    // FR-009 for the console, FR-044a for the application. Credentials arrive
    // by hand here, so "this is not my address" is a mistake worth catching.
    const route = signedInRoutes.find((candidate) => candidate.file === file);

    expect(route?.source, `${file} renders no <AccountBadge />`).toMatch(/<AccountBadge[\s/>]/);
  });

  it("includes the first-login screen, which has no shell above it", () => {
    const welcome = signedInRoutes.find((route) => route.file.includes("welcome"));

    expect(welcome).toBeDefined();
    expect(welcome?.shell).toBeNull();
  });
});

describe("the sign-in screens", () => {
  it("carry the mark but no account badge, because nobody is signed in", () => {
    const anonymous = routes.filter((route) =>
      ANONYMOUS.some((prefix) => route.file.startsWith(prefix)),
    );

    expect(anonymous.length).toBe(2);
    for (const route of anonymous) {
      expect(route.source).toMatch(/<Mark[\s/>]/);
      expect(route.source, `${route.file} should not claim an account`).not.toMatch(
        /<AccountBadge[\s/>]/,
      );
    }
  });
});
