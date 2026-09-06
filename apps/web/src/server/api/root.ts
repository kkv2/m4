import { createCallerFactory, createTRPCRouter } from "./trpc";
import { adminTenantsRouter } from "./routers/admin/tenants";
import { adminUsersRouter } from "./routers/admin/users";
import { healthRouter } from "./routers/health";
import { operatorAuthRouter } from "./routers/operator-auth";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  operatorAuth: operatorAuthRouter,
  admin: createTRPCRouter({
    tenants: adminTenantsRouter,
    users: adminUsersRouter,
  }),
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
