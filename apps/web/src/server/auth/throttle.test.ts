import { SignInSurface, ThrottleScope, prisma } from "@m4/db";
import { describe, expect, it } from "vitest";

import { uniqueEmail, uniqueSuffix } from "~/server/testing/fixtures";

import {
  FAILURE_THRESHOLD,
  WINDOW_MS,
  clearAccountFailures,
  isThrottled,
  recordFailure,
} from "./throttle";

function keys(overrides: { email?: string; client?: string | null } = {}) {
  return {
    surface: SignInSurface.TENANT,
    email: overrides.email ?? uniqueEmail("throttle"),
    client: overrides.client === undefined ? `10.0.0.${uniqueSuffix()}` : overrides.client,
  };
}

async function failTimes(target: ReturnType<typeof keys>, times: number) {
  for (let i = 0; i < times; i += 1) await recordFailure(target);
}

/** Every key a target counts against, for querying the rows back. */
function keyList(target: ReturnType<typeof keys>): string[] {
  return target.client === null ? [target.email] : [target.email, target.client];
}

describe("isThrottled", () => {
  it("lets an untouched account through", async () => {
    await expect(isThrottled(keys())).resolves.toBe(false);
  });

  it("lets an account through below the threshold", async () => {
    const target = keys();

    await failTimes(target, FAILURE_THRESHOLD - 1);

    await expect(isThrottled(target)).resolves.toBe(false);
  });

  it("refuses once the threshold is reached", async () => {
    const target = keys();

    await failTimes(target, FAILURE_THRESHOLD);

    await expect(isThrottled(target)).resolves.toBe(true);
  });

  it("releases on its own once the window has passed, with no operator action", async () => {
    const target = keys();
    await failTimes(target, FAILURE_THRESHOLD);

    await prisma.signInThrottle.updateMany({
      where: { surface: target.surface, key: { in: keyList(target) } },
      data: { windowStartedAt: new Date(Date.now() - WINDOW_MS - 1000) },
    });

    await expect(isThrottled(target)).resolves.toBe(false);
  });

  it("counts the client separately, so an address sweep still trips", async () => {
    const client = `10.1.1.${uniqueSuffix()}`;

    // One failure each against five different addresses from the same client.
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      await recordFailure(keys({ client }));
    }

    // A sixth, previously untouched address from that same client is refused.
    await expect(isThrottled(keys({ client }))).resolves.toBe(true);
  });

  it("keeps operator and tenant counters apart", async () => {
    const email = uniqueEmail("both");
    const client = `10.2.2.${uniqueSuffix()}`;

    await failTimes({ surface: SignInSurface.TENANT, email, client }, FAILURE_THRESHOLD);

    await expect(isThrottled({ surface: SignInSurface.TENANT, email, client })).resolves.toBe(true);
    await expect(isThrottled({ surface: SignInSurface.OPERATOR, email, client })).resolves.toBe(
      false,
    );
  });

  it("behaves identically for an address that has no account", async () => {
    // Nothing in this module ever looks a user up, so an unregistered address
    // is throttled exactly like a registered one. That is what stops throttling
    // from revealing whether an account exists.
    const unregistered = keys({ email: uniqueEmail("nobody") });

    await failTimes(unregistered, FAILURE_THRESHOLD);

    await expect(isThrottled(unregistered)).resolves.toBe(true);
  });

  it("copes with a client that cannot be determined", async () => {
    const target = keys({ client: null });

    await failTimes(target, FAILURE_THRESHOLD);

    await expect(isThrottled(target)).resolves.toBe(true);
  });
});

describe("recordFailure", () => {
  it("counts against the account and the client together", async () => {
    const target = keys();

    await failTimes(target, 3);

    const rows = await prisma.signInThrottle.findMany({
      where: { surface: target.surface, key: { in: keyList(target) } },
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.failureCount).toBe(3);
  });

  it("resets a stale window in place rather than accumulating", async () => {
    const target = keys();
    await failTimes(target, FAILURE_THRESHOLD);

    await prisma.signInThrottle.updateMany({
      where: { surface: target.surface, key: { in: keyList(target) } },
      data: { windowStartedAt: new Date(Date.now() - WINDOW_MS - 1000) },
    });
    await recordFailure(target);

    const row = await prisma.signInThrottle.findUnique({
      where: {
        surface_scope_key: {
          surface: target.surface,
          scope: ThrottleScope.ACCOUNT,
          key: target.email,
        },
      },
    });

    expect(row?.failureCount).toBe(1);
    await expect(isThrottled(target)).resolves.toBe(false);
  });

  it("treats an address as the same key whatever its case or padding", async () => {
    const email = uniqueEmail("Mixed");
    const client = `10.3.3.${uniqueSuffix()}`;

    await recordFailure({ surface: SignInSurface.TENANT, email: email.toUpperCase(), client });
    await recordFailure({ surface: SignInSurface.TENANT, email: `  ${email}  `, client });

    const row = await prisma.signInThrottle.findUnique({
      where: {
        surface_scope_key: {
          surface: SignInSurface.TENANT,
          scope: ThrottleScope.ACCOUNT,
          key: email.toLowerCase(),
        },
      },
    });

    expect(row?.failureCount).toBe(2);
  });
});

describe("clearAccountFailures", () => {
  it("resets the account counter after a successful sign-in", async () => {
    const target = keys();
    await failTimes(target, FAILURE_THRESHOLD - 1);

    await clearAccountFailures(target.surface, target.email);

    const row = await prisma.signInThrottle.findUnique({
      where: {
        surface_scope_key: {
          surface: target.surface,
          scope: ThrottleScope.ACCOUNT,
          key: target.email,
        },
      },
    });

    expect(row).toBeNull();
  });

  it("leaves the client counter alone, so one good sign-in does not clear a sweep", async () => {
    const client = `10.4.4.${uniqueSuffix()}`;
    const target = keys({ client });
    await failTimes(target, 2);

    await clearAccountFailures(target.surface, target.email);

    const row = await prisma.signInThrottle.findUnique({
      where: {
        surface_scope_key: {
          surface: target.surface,
          scope: ThrottleScope.CLIENT,
          key: client,
        },
      },
    });

    expect(row?.failureCount).toBe(2);
  });
});
