import { ThrottleScope, prisma } from "@m4/db";
import type { SignInSurface } from "@m4/db";

/**
 * FR-022a to FR-022e. Failures are counted per account and per calling client,
 * in the database rather than in memory: an in-memory map resets on every
 * dev-server reload, cannot be asserted on from a test in another process, and
 * is wrong the moment there is more than one process.
 *
 * Nothing here distinguishes a registered address from an unregistered one. The
 * ACCOUNT key is the submitted address, not a user id, which is what keeps
 * throttling from leaking whether an account exists.
 */

/** FR-022c. */
export const FAILURE_THRESHOLD = 5;
export const WINDOW_MS = 15 * 60 * 1000;

export interface ThrottleKeys {
  surface: SignInSurface;
  /** The submitted email address, lowercased by the caller's normalisation. */
  email: string;
  /** The calling client's address, or null when it cannot be determined. */
  client: string | null;
}

function keysOf(keys: ThrottleKeys): { scope: ThrottleScope; key: string }[] {
  const pairs: { scope: ThrottleScope; key: string }[] = [
    { scope: ThrottleScope.ACCOUNT, key: keys.email.trim().toLowerCase() },
  ];
  if (keys.client) pairs.push({ scope: ThrottleScope.CLIENT, key: keys.client });
  return pairs;
}

/**
 * True when this attempt must be refused without the password being compared.
 * A window older than WINDOW_MS counts as empty, so the cooling-off period
 * releases on its own with no operator action (FR-022b, FR-022d).
 */
export async function isThrottled(keys: ThrottleKeys): Promise<boolean> {
  const threshold = new Date(Date.now() - WINDOW_MS);

  const blocking = await prisma.signInThrottle.findFirst({
    where: {
      surface: keys.surface,
      OR: keysOf(keys).map(({ scope, key }) => ({ scope, key })),
      failureCount: { gte: FAILURE_THRESHOLD },
      windowStartedAt: { gt: threshold },
    },
    select: { id: true },
  });

  return blocking !== null;
}

/** Count one failed attempt against every key that applies. */
export async function recordFailure(keys: ThrottleKeys): Promise<void> {
  const now = new Date();
  const windowFloor = new Date(now.getTime() - WINDOW_MS);

  for (const { scope, key } of keysOf(keys)) {
    const existing = await prisma.signInThrottle.findUnique({
      where: { surface_scope_key: { surface: keys.surface, scope, key } },
      select: { id: true, windowStartedAt: true },
    });

    if (!existing) {
      await prisma.signInThrottle.create({
        data: { surface: keys.surface, scope, key, failureCount: 1, windowStartedAt: now },
      });
      continue;
    }

    // A stale window resets in place. That is the whole expiry mechanism —
    // there is no background job, by design.
    if (existing.windowStartedAt <= windowFloor) {
      await prisma.signInThrottle.update({
        where: { id: existing.id },
        data: { failureCount: 1, windowStartedAt: now },
      });
      continue;
    }

    await prisma.signInThrottle.update({
      where: { id: existing.id },
      data: { failureCount: { increment: 1 } },
    });
  }
}

/**
 * FR-022c: a successful sign-in resets that account's counter. The client
 * counter is left alone — one good sign-in should not clear the record of an
 * address sweep from the same machine.
 */
export async function clearAccountFailures(surface: SignInSurface, email: string): Promise<void> {
  await prisma.signInThrottle.deleteMany({
    where: { surface, scope: ThrottleScope.ACCOUNT, key: email.trim().toLowerCase() },
  });
}
