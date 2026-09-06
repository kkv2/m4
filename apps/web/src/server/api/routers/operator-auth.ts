import { SignInSurface } from "@m4/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  OPERATOR_SESSION_COOKIE,
  serialiseClearedCookie,
  serialiseOperatorSessionCookie,
} from "~/server/auth/cookies";
import { verifyPassword } from "~/server/auth/password";
import { createOperatorSession, revokeOperatorSession } from "~/server/auth/session";
import { clearAccountFailures, isThrottled, recordFailure } from "~/server/auth/throttle";

import { createTRPCRouter, operatorProcedure, publicProcedure } from "../trpc";

/**
 * Operator sign-in. There is deliberately no `create` procedure: FR-004 forbids
 * any network-facing path that makes an operator account, so the only way one
 * comes into existence is the bootstrap CLI.
 */

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * One error for every way sign-in can fail on the credentials themselves —
 * wrong password, unknown address, an account that vanished mid-request. FR-022
 * requires that a caller cannot tell which.
 */
function refuse(): never {
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
}

export const operatorAuthRouter = createTRPCRouter({
  signIn: publicProcedure.input(credentials).mutation(async ({ ctx, input }) => {
    const keys = {
      surface: SignInSurface.OPERATOR,
      email: input.email,
      client: ctx.clientAddress,
    };

    // Checked before the password is compared, and identically for an address
    // that has no account — which is what keeps FR-022e intact.
    if (await isThrottled(keys)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many sign-in attempts.",
      });
    }

    const operator = await ctx.prisma.operator.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    });

    // Verify against a throwaway hash when the address is unknown, so that a
    // missing account does not return measurably faster than a wrong password.
    const passwordHash = operator?.passwordHash ?? "";
    const matches = await verifyPassword(input.password, passwordHash);

    if (!operator || !matches) {
      await recordFailure(keys);
      refuse();
    }

    await clearAccountFailures(SignInSurface.OPERATOR, input.email);

    const session = await createOperatorSession(operator.id);
    ctx.resHeaders.append("set-cookie", serialiseOperatorSessionCookie(session.token));
  }),

  signOut: operatorProcedure.mutation(async ({ ctx }) => {
    await revokeOperatorSession(ctx.operator.sessionTokenHash);
    ctx.resHeaders.append("set-cookie", serialiseClearedCookie(OPERATOR_SESSION_COOKIE));
  }),

  me: operatorProcedure.query(({ ctx }) => ({
    id: ctx.operator.id,
    email: ctx.operator.email,
  })),
});
