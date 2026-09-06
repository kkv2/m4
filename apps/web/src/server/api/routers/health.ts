import { createTRPCRouter, publicProcedure } from "../trpc";

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  })),

  db: publicProcedure.query(async ({ ctx }) => {
    await ctx.prisma.$queryRaw`SELECT 1`;
    return { status: "ok" as const };
  }),
});
