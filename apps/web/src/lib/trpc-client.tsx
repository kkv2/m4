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

/**
 * Where the BFF is.
 *
 * Empty in the browser, so the request is relative and the app works from
 * whatever origin it is actually served on — `localhost`, `127.0.0.1`, a LAN
 * address, a preview URL. Building an absolute URL from `NEXT_PUBLIC_APP_URL`
 * tied the app to exactly one hostname, which is a coupling nothing needed.
 *
 * On the server there is no origin to be relative to, so the configured one is
 * used. Nothing fetches during SSR today — these queries run in Client
 * Components after mount — but a relative URL there would fail silently if
 * something ever did.
 */
function bffUrl(): string {
  const origin = typeof window === "undefined" ? clientEnv.NEXT_PUBLIC_APP_URL : "";
  return `${origin}/api/trpc`;
}

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
          url: bffUrl(),
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
