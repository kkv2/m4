# apps/web

The Next.js application: the UI and the tRPC BFF that sits between it and the
services behind it. See the root `CLAUDE.md` for workflow rules.

## Boundaries

- `src/app/` — App Router routes, layouts and the tRPC HTTP handler at
  `api/trpc/[trpc]/route.ts`. Server Components by default; add `"use client"`
  only where interactivity requires it.
- `src/server/` — **server-only**. tRPC routers, request context and the LLM
  provider clients. Nothing here may be imported from a client component.
- `src/lib/` — code shared with the browser, including the tRPC React provider.
- `src/env/` — `server.ts` for secrets, `client.ts` for `NEXT_PUBLIC_*`.
- `e2e/` — Playwright specs, run against a real dev server.

## Adding a tRPC procedure

1. Create or extend a router in `src/server/api/routers/`.
2. Use `publicProcedure` only for genuinely unauthenticated data;
   `protectedProcedure` otherwise.
3. Validate every input with a Zod schema — the input type is derived from it,
   never hand-written.
4. Scope tenant data by `ctx.tenantId`, which `protectedProcedure` guarantees.
5. Register the router in `src/server/api/root.ts`.

## Testing

`pnpm test` runs Vitest in jsdom against `src/**/*.{test,spec}.{ts,tsx}`.
`pnpm test:e2e` runs Playwright, which starts its own dev server.

## Next.js agent rules

`next dev` writes a managed block of Next.js-version-specific guidance into an
agent instructions file whenever it detects an AI coding agent. It prefers
`AGENTS.md` when that file exists, so the block lives there and this file stays
hand-authored — a vendor-managed section here would be rewritten on every
Next.js upgrade, and it would turn `pnpm dev` into a source of permanent
uncommitted diffs.

`AGENTS.md` is imported below rather than duplicated, so the guidance still
reaches the agent. Treat that file as generated: let `next dev` update it and
commit the result alongside the Next.js version bump that caused it.

@AGENTS.md
