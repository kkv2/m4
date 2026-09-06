import { SignInSurface } from "@m4/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  TENANT_SESSION_COOKIE,
  serialiseClearedCookie,
  serialiseTenantSessionCookie,
} from "~/server/auth/cookies";
import { verifyPassword } from "~/server/auth/password";
import { createUserSession, revokeUserSession } from "~/server/auth/session";
import { clearAccountFailures, isThrottled, recordFailure } from "~/server/auth/throttle";

import { createTRPCRouter, onboardingProcedure, publicProcedure } from "../trpc";

/**
 * Tenant sign-in.
 *
 * FR-021: an address and a password, those two values alone. Email addresses
 * are unique across the platform, so the address identifies both the account
 * and its tenant — there is no tenant identifier to supply or select.
 */

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * Where the caller goes after signing in, computed in one place from the
 * first-login state so that three screens cannot each derive it and disagree.
 */
export type SignInDestination = "language" | "password" | "app";

export function destinationFor(user: {
  languageConfirmedAt: Date | null;
  mustChangePassword: boolean;
}): SignInDestination {
  if (user.languageConfirmedAt === null) return "language";
  if (user.mustChangePassword) return "password";
  return "app";
}

/** One error for every way the credentials can fail, per FR-022. */
function refuse(): never {
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
}

export const authRouter = createTRPCRouter({
  signIn: publicProcedure
    .input(credentials)
    .mutation(async ({ ctx, input }): Promise<{ next: SignInDestination }> => {
      const keys = { surface: SignInSurface.TENANT, email: input.email, client: ctx.clientAddress };

      if (await isThrottled(keys)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts." });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          passwordHash: true,
          languageConfirmedAt: true,
          mustChangePassword: true,
        },
      });

      // Verified even when the address is unknown, so a missing account does not
      // return measurably faster than a wrong password.
      const matches = await verifyPassword(input.password, user?.passwordHash ?? "");

      if (!user || !matches) {
        await recordFailure(keys);
        refuse();
      }

      await clearAccountFailures(SignInSurface.TENANT, input.email);

      const session = await createUserSession(user.id);
      ctx.resHeaders.append("set-cookie", serialiseTenantSessionCookie(session.token));

      return { next: destinationFor(user) };
    }),

  signOut: onboardingProcedure.mutation(async ({ ctx }) => {
    await revokeUserSession(ctx.user.sessionTokenHash);
    ctx.resHeaders.append("set-cookie", serialiseClearedCookie(TENANT_SESSION_COOKIE));
  }),

  /**
   * The signed-in account, for the application shell (FR-044a). Available before
   * first login is complete, because the shell around the first-login steps
   * shows it too. Never returns a password or a hash.
   */
  me: onboardingProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.prisma.tenant.findUniqueOrThrow({
      where: { id: ctx.tenantId },
      select: { name: true },
    });

    return {
      id: ctx.user.id,
      email: ctx.user.email,
      displayName: ctx.user.name,
      language: ctx.user.language,
      tenantId: ctx.user.tenantId,
      tenantName: tenant.name,
      next: destinationFor(ctx.user),
      firstLoginCompleted: ctx.user.firstLoginCompletedAt !== null,
    };
  }),
});
