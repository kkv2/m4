import { createCallerFactory, createTRPCRouter } from "./trpc";
import { adminTenantsRouter } from "./routers/admin/tenants";
import { adminUsersRouter } from "./routers/admin/users";
import { accountRouter } from "./routers/account";
import { authRouter } from "./routers/auth";
import { healthRouter } from "./routers/health";
import { onboardingRouter } from "./routers/onboarding";
import { operatorAuthRouter } from "./routers/operator-auth";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  onboarding: onboardingRouter,
  account: accountRouter,
  operatorAuth: operatorAuthRouter,
  admin: createTRPCRouter({
    tenants: adminTenantsRouter,
    users: adminUsersRouter,
  }),
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
