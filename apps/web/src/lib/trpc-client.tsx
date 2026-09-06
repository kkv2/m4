"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState, type ReactNode } from "react";
import superjson from "superjson";

import type { AppRouter } from "~/server/api/root";
import { clientEnv } from "~/env/client";

export const api = createTRPCReact<AppRouter>();

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
