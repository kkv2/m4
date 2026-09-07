"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState, type ReactNode } from "react";
import superjson from "superjson";

import type { AppRouter } from "~/server/api/root";
import { clientEnv } from "~/env/client";

export const api = createTRPCReact<AppRouter>();

/**
 * Query options for reads that must not be served from cache.
 *
 * The default `staleTime` above keeps a result for 30 seconds, which is right
 * for most screens and wrong for the operator console: an operator opens it to
 * find out whether onboarding has landed, and a 30-second-old answer to that
 * question is the one thing the screen exists to avoid. Found by walking the
 * quickstart, which says "open the tenant" and got a stale flag.
 */
export const FRESH = { staleTime: 0, refetchOnMount: "always" } as const;

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000 },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${clientEnv.NEXT_PUBLIC_APP_URL}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
