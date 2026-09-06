import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Open to anyone who can reach the BFF. */
export const publicProcedure = t.procedure;

/**
 * A signed-in tenant user, whether or not they have finished first login.
 *
 * Only the onboarding procedures should use this. Everything else uses
 * `protectedProcedure`, which additionally requires first login to be complete.
 */
export const onboardingProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
      tenantId: ctx.session.tenantId,
    },
  });
});

/**
 * Requires an authenticated session whose first login is complete. Every
 * downstream query must additionally scope by `ctx.tenantId` — multi-tenancy is
 * enforced per query, not globally.
 *
 * The first-login check lives here so that every present and future application
 * procedure inherits FR-034 without having to remember it.
 */
export const protectedProcedure = onboardingProcedure.use(({ ctx, next }) => {
  if (ctx.user.firstLoginCompletedAt === null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "First login is not complete.",
    });
  }
  return next({ ctx });
});

/**
 * A signed-in SaaS operator.
 *
 * Deliberately yields no `tenantId`. The operator console reads across tenants
 * by design, and with no ambient tenant on the context, every such read has to
 * name its tenant as an explicit input — which is what keeps the cross-tenant
 * access visible in the query rather than implied by the session.
 */
export const operatorProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.operator) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      operator: ctx.operator,
    },
  });
});
