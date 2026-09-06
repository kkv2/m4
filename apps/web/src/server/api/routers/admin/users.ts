import { Language, Prisma } from "@m4/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generatePassword, hashPassword } from "~/server/auth/password";
import { revokeOtherUserSessions } from "~/server/auth/session";

import { createTRPCRouter, operatorProcedure } from "../../trpc";

/**
 * Tenant-user registration and review, for the operator console.
 *
 * Like the tenant router, these read across tenants by design. `operatorProcedure`
 * yields no ambient `tenantId`, so every read that concerns one tenant names it
 * as an explicit input.
 *
 * There is no update procedure for the email address (FR-018) and no delete
 * procedure for anything (FR-046).
 */

const cuid = z.string().cuid();

/** FR-015: address, display name, language. */
const registration = z.object({
  tenantId: cuid,
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(100),
  language: z.nativeEnum(Language),
});

interface UserSummary {
  id: string;
  email: string;
  name: string;
  language: Language;
  /** FR-020. Null means first login is not complete. */
  firstLoginCompletedAt: Date | null;
  createdAt: Date;
}

const summarySelect = {
  id: true,
  email: true,
  name: true,
  language: true,
  firstLoginCompletedAt: true,
  createdAt: true,
} as const;

/**
 * FR-019. The message deliberately does not say which tenant holds the address:
 * an operator asking "is this person already a customer of ours?" would
 * otherwise get an answer from a registration form.
 */
function addressTaken(): never {
  throw new TRPCError({
    code: "CONFLICT",
    message: "That email address is already in use.",
  });
}

export const adminUsersRouter = createTRPCRouter({
  listByTenant: operatorProcedure
    .input(z.object({ tenantId: cuid }))
    .query(async ({ ctx, input }): Promise<UserSummary[]> => {
      return ctx.prisma.user.findMany({
        where: { tenantId: input.tenantId },
        select: summarySelect,
        orderBy: { createdAt: "asc" },
      });
    }),

  create: operatorProcedure
    .input(registration)
    .mutation(async ({ ctx, input }): Promise<{ id: string; generatedPassword: string }> => {
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { id: true },
      });
      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such tenant." });
      }

      // FR-017: the system generates the password; the operator cannot choose it.
      const generatedPassword = generatePassword();
      const passwordHash = await hashPassword(generatedPassword);

      try {
        const user = await ctx.prisma.user.create({
          data: {
            tenantId: input.tenantId,
            email: input.email,
            name: input.name,
            passwordHash,
            language: input.language,
            // Both first-login markers start unset: the user has to choose a
            // language and replace this password before reaching the app.
            mustChangePassword: true,
          },
          select: { id: true },
        });

        // The only place a password crosses the wire, in the response to the
        // call that generated it (FR-003).
        return { id: user.id, generatedPassword };
      } catch (error) {
        // Caught rather than pre-checked, so two concurrent registrations of the
        // same address cannot both succeed.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          addressTaken();
        }
        throw error;
      }
    }),

  reissuePassword: operatorProcedure
    .input(z.object({ userId: cuid }))
    .mutation(async ({ ctx, input }): Promise<{ generatedPassword: string }> => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such user." });
      }

      const generatedPassword = generatePassword();
      const passwordHash = await hashPassword(generatedPassword);

      // FR-035: reissue does not re-trigger first login. `mustChangePassword`
      // and `firstLoginCompletedAt` are left exactly as they were — true for a
      // user who never finished, false for one who did.
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { passwordHash },
      });

      // FR-023c: keep nothing. Reissue is how a compromised account is shut out,
      // which it cannot be if the intruder's session survives.
      await revokeOtherUserSessions(input.userId, null);

      return { generatedPassword };
    }),
});
