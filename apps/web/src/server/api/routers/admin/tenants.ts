import { Language } from "@m4/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, operatorProcedure } from "../../trpc";

/**
 * Tenant registration and review, for the operator console.
 *
 * These procedures read across tenants, which every other procedure in the
 * application is forbidden from doing. That is the console's whole purpose, and
 * the constitution's requirement is that the scope be visible in the query
 * rather than that a session always supply one. Two things keep it honest:
 * `operatorProcedure` yields no ambient `tenantId`, and every read below that
 * concerns one tenant takes its identifier as an explicit input.
 */

const languageSchema = z.nativeEnum(Language);

const tenantId = z.string().cuid();

/** FR-010: display name and default language, nothing else. */
const registration = z.object({
  name: z.string().trim().min(1).max(200),
  defaultLanguage: languageSchema.default(Language.JA),
});

/**
 * FR-013. Both counts are aggregates rather than counter columns: a stale
 * counter is worse than a cheap count at this scale, and the conversation count
 * has to keep working when issue #23 starts writing rows.
 */
const summarySelect = {
  id: true,
  name: true,
  defaultLanguage: true,
  createdAt: true,
  _count: { select: { users: true, conversations: true } },
} as const;

interface TenantSummary {
  id: string;
  name: string;
  defaultLanguage: Language;
  createdAt: Date;
  userCount: number;
  /** FR-014: structurally zero until the chat feature exists. */
  conversationCount: number;
}

function toSummary(row: {
  id: string;
  name: string;
  defaultLanguage: Language;
  createdAt: Date;
  _count: { users: number; conversations: number };
}): TenantSummary {
  return {
    id: row.id,
    name: row.name,
    defaultLanguage: row.defaultLanguage,
    createdAt: row.createdAt,
    userCount: row._count.users,
    conversationCount: row._count.conversations,
  };
}

export const adminTenantsRouter = createTRPCRouter({
  list: operatorProcedure.query(async ({ ctx }): Promise<TenantSummary[]> => {
    const rows = await ctx.prisma.tenant.findMany({
      select: summarySelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toSummary);
  }),

  get: operatorProcedure
    .input(z.object({ tenantId }))
    .query(async ({ ctx, input }): Promise<TenantSummary> => {
      const row = await ctx.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: summarySelect,
      });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No such tenant." });
      }

      return toSummary(row);
    }),

  create: operatorProcedure
    .input(registration)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      // Display names are deliberately not unique: two customers may
      // legitimately share one, and the identifier is what tells them apart.
      const tenant = await ctx.prisma.tenant.create({
        data: { name: input.name, defaultLanguage: input.defaultLanguage },
        select: { id: true },
      });

      return tenant;
    }),
});
