# apps/web

The Next.js application: the UI and the tRPC BFF that sits between it and the
services behind it. See the root `CLAUDE.md` for workflow rules.

## Boundaries

- `src/app/` — App Router routes, layouts and the tRPC HTTP handler at
  `api/trpc/[trpc]/route.ts`. Server Components by default; add `"use client"`
  only where interactivity requires it.
- `src/server/` — **server-only**. tRPC routers, request context, session and
  password handling, and the LLM provider clients. Nothing here may be imported
  from a Client Component. `src/server-boundary.test.ts` asserts that: it scans
  every `"use client"` file and fails on a runtime import of `~/server/` or
  `@m4/db`. Type-only imports pass, because they are erased.
- `src/components/` — components used by both the operator console and the
  tenant application.
- `src/i18n/` — the Japanese and English message dictionaries. `ja.ts` is the
  source of the key type and `en.ts` is typed against it, so a missing
  translation is a compile error. Operator console copy lives in
  `messages/admin.ts`, outside that type: the console is Japanese-only, and
  putting its keys in `Messages` would oblige `en.ts` to translate screens
  nobody sees in English.
- `src/lib/` — code shared with the browser: the tRPC React provider, and the
  handful of constants both sides need. When a Client Component needs something
  that lives under `src/server/`, the shared part moves here rather than the
  import crossing the boundary.
- `src/env/` — `server.ts` for secrets, `client.ts` for `NEXT_PUBLIC_*`.
- `e2e/` — Playwright specs, run against a real dev server. Each test runs from
  its own `x-forwarded-for`, because sign-in throttling counts per client and
  the suite would otherwise lock itself out.

## Adding a tRPC procedure

1. Create or extend a router in `src/server/api/routers/`.
2. **Pick the right builder.** This is a security decision, not a convenience:

   | Builder | For | Gives you |
   | --- | --- | --- |
   | `publicProcedure` | genuinely unauthenticated data, and sign-in | nothing |
   | `onboardingProcedure` | **only** the two first-login steps | `session`, `user`, `tenantId` |
   | `protectedProcedure` | every other tenant-facing procedure | the same, and refuses until first login is complete |
   | `operatorProcedure` | the operator console | `operator`, and deliberately **no** `tenantId` |

   Reaching for `onboardingProcedure` outside `routers/onboarding.ts` bypasses
   the first-login gate. If a procedure seems to need it, the question to ask is
   why it must run before the user has replaced the password they were handed.

3. Validate every input with a Zod schema — the input type is derived from it,
   never hand-written.
4. Scope tenant data by `ctx.tenantId`, which `protectedProcedure` guarantees.
   `operatorProcedure` has none on purpose: the console reads across tenants, so
   each such read names its tenant as an explicit input and the cross-tenant
   access is visible in the query rather than implied by the session.
5. **Take no identifier the session already knows.** A procedure that acts on
   the caller must not accept a `userId` — then acting on somebody else is not a
   check that could be forgotten, it is a request that cannot be expressed. See
   `routers/account.ts`.
6. Read mutable state from the row you are about to change, not from `ctx.user`.
   That is a snapshot taken when the request's context was built, so two
   requests arriving together would both see it and both pass the same check.
7. Register the router in `src/server/api/root.ts`.

## Testing

`pnpm test` runs Vitest in jsdom against `src/**/*.{test,spec}.{ts,tsx}`, and
needs a migrated database — router tests go through `createCaller` against real
PostgreSQL, because the properties worth proving (tenant isolation, the operator
boundary) are not things a mocked client can prove.

Test files share one database and run in parallel, so **every write and every
assertion must be scoped to rows that test created**. `src/server/testing/
fixtures.ts` gives every fixture a random suffix for this reason; a bare
`count()` or an unscoped `updateMany` is a race against the rest of the suite.

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
