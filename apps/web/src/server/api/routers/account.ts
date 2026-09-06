import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { LANGUAGES } from "~/i18n";
import { hashPassword, verifyPassword } from "~/server/auth/password";
import { checkPasswordPolicy } from "~/server/auth/password-policy";
import { revokeOtherUserSessions } from "~/server/auth/session";

import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * The settings screen's procedures.
 *
 * Every one of these acts on `ctx.session.userId`, and **none takes a user id
 * as input**. That is how FR-041 is enforced: acting on somebody else is not a
 * check that could be forgotten, it is a request that cannot be expressed.
 *
 * There is no procedure that changes an email address (FR-018).
 */

/** Reused from the onboarding router; the same rule, the same message key. */
function rejectPassword(rule: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message: rule });
}

export const accountRouter = createTRPCRouter({
  get: protectedProcedure.query(({ ctx }) => ({
    // FR-037: the identifier and the address, shown but not editable.
    id: ctx.user.id,
    email: ctx.user.email,
    displayName: ctx.user.name,
    language: ctx.user.language,
  })),

  updateDisplayName: protectedProcedure
    .input(z.object({ displayName: z.string().trim().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { name: input.displayName },
      });
    }),

  updateLanguage: protectedProcedure
    .input(z.object({ language: z.enum(LANGUAGES) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { language: input.language },
      });
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        select: { passwordHash: true, name: true },
      });

      if (!(await verifyPassword(input.currentPassword, current.passwordHash))) {
        rejectPassword("current-incorrect");
      }

      if (await verifyPassword(input.newPassword, current.passwordHash)) {
        rejectPassword("same-as-current");
      }

      const verdict = checkPasswordPolicy(input.newPassword, {
        // The address is immutable; the display name is not, so it comes from
        // the row rather than from the request's snapshot of it.
        email: ctx.user.email,
        displayName: current.name,
      });
      if (!verdict.ok) {
        rejectPassword(verdict.failure.rule);
      }

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { passwordHash: await hashPassword(input.newPassword) },
      });

      // FR-023c: every other session ends; the one making the change continues,
      // so a user does not sign themselves out by changing their password.
      await revokeOtherUserSessions(ctx.user.id, ctx.user.sessionTokenHash);
    }),
});
