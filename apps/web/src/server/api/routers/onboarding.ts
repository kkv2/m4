import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { LANGUAGES } from "~/i18n";
import { hashPassword, verifyPassword } from "~/server/auth/password";
import { checkPasswordPolicy, type PasswordPolicyFailure } from "~/server/auth/password-policy";
import { revokeOtherUserSessions } from "~/server/auth/session";

import { createTRPCRouter, onboardingProcedure } from "../trpc";

/**
 * The two first-login steps (FR-027 to FR-035).
 *
 * These use `onboardingProcedure`, which authenticates but does not require
 * first login to be complete — they are the only procedures that may run before
 * it is. Everything else uses `protectedProcedure`, which refuses until both
 * steps are done.
 *
 * Each step refuses if it is already finished, so a replayed request cannot
 * rewind the state machine. That check reads the row it is about to update
 * rather than `ctx.user`, which is a snapshot taken when the request's context
 * was built: two requests arriving together would both see the same stale
 * snapshot and both pass.
 */

/** The failure a caller gets back, so the screen can name the rule (FR-032b). */
export type PasswordRejection = PasswordPolicyFailure | { rule: "same-as-issued" };

function rejectPassword(rejection: PasswordRejection): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: rejection.rule,
    cause: rejection,
  });
}

export const onboardingRouter = createTRPCRouter({
  confirmLanguage: onboardingProcedure
    .input(z.object({ language: z.enum(LANGUAGES) }))
    .mutation(async ({ ctx, input }): Promise<{ next: "password" }> => {
      const current = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        select: { languageConfirmedAt: true },
      });
      if (current.languageConfirmedAt !== null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Language is already confirmed." });
      }

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { language: input.language, languageConfirmedAt: new Date() },
      });

      return { next: "password" };
    }),

  replacePassword: onboardingProcedure
    .input(z.object({ newPassword: z.string().min(1) }))
    .mutation(async ({ ctx, input }): Promise<{ next: "app" }> => {
      const current = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        select: {
          passwordHash: true,
          languageConfirmedAt: true,
          mustChangePassword: true,
          name: true,
        },
      });

      if (current.languageConfirmedAt === null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirm your language first." });
      }
      if (!current.mustChangePassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password is already yours." });
      }

      // FR-032: it must differ from the one the operator issued. Compared
      // against the stored hash rather than a remembered plaintext, because
      // there is no remembered plaintext.
      if (await verifyPassword(input.newPassword, current.passwordHash)) {
        rejectPassword({ rule: "same-as-issued" });
      }

      const verdict = checkPasswordPolicy(input.newPassword, {
        // The address is immutable, so the snapshot is always right for it. The
        // display name is not, so it comes from the row.
        email: ctx.user.email,
        displayName: current.name,
      });
      if (!verdict.ok) {
        rejectPassword(verdict.failure);
      }

      const now = new Date();
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          passwordHash: await hashPassword(input.newPassword),
          mustChangePassword: false,
          // Both steps are done, so first login is complete (FR-033).
          firstLoginCompletedAt: now,
        },
      });

      // FR-023c. The session making the change continues; anything else that
      // was opened with the issued password ends here.
      await revokeOtherUserSessions(ctx.user.id, ctx.user.sessionTokenHash);

      return { next: "app" };
    }),
});
