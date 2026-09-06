# Implementation Plan: Operator Console, Tenant & User Onboarding, First Login

**Branch**: `feature/22-admin-console-onboarding` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-admin-console-onboarding/spec.md`

## Summary

This feature gives M4 its first accounts and its first screens. A SaaS operator
is bootstrapped from the command line, signs in to a Japanese-only console,
registers customer tenants and the users inside them, and hands over generated
credentials out of band. Those users sign in, are walked through a blocking
first-login step — choose a language, replace the issued password — and land in
an application shell that knows who they are and which tenant they belong to.

The technical shape is a hand-rolled, database-backed session layer with two
disjoint principal types, expressed as three new tRPC procedure builders on top
of the one that already exists. Nothing about the existing architecture changes:
tRPC stays the BFF, Prisma stays the data layer, and tenant scoping stays a
per-query obligation. What changes is that `ctx.session` stops being `null`.

The single most consequential decision is R1 — no authentication library. The
spec asks for two principal types, a blocking onboarding state, and server-side
session revocation; each of those fights the abstraction a library provides, and
none of the provider machinery a library exists for is in scope.

## Technical Context

**Language/Version**: TypeScript 5.7, strict, with `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`. Node 22.14 (`.nvmrc`).

**Primary Dependencies**: Next.js 16 (App Router), React 19, tRPC 11, Prisma 7
via `@prisma/adapter-pg`, Zod 3, Tailwind CSS 4. **One new dev dependency**:
`tsx`, to run the operator-bootstrap CLI (R6). No new runtime dependencies —
password hashing is `node:crypto` (R2) and internationalisation is two typed
message modules (R4).

**Storage**: PostgreSQL, local via `docker/docker-compose.yml`. This feature
introduces the repository's first Prisma migration (R9).

**Testing**: Vitest for unit and integration (`src/**/*.test.ts(x)`), Playwright
for E2E (`apps/web/e2e/*.spec.ts`).

**Target Platform**: Web, local development only.

**Project Type**: pnpm workspace monorepo — `apps/web` (Next.js + tRPC BFF),
`packages/db` (Prisma), `packages/config` (shared ESLint and tsconfig).

**Performance Goals**: None stated beyond the spec's user-facing timings
(SC-001, SC-002). Session resolution is one indexed lookup per protected render.

**Constraints**: No outbound network requests of any kind — no email, no breach
API, no OAuth provider. **No new environment variables**, so `src/env/server.ts`
and `.env.example` are untouched.

**Scale/Scope**: Tens of tenants, hundreds of users. Roughly 12 screens across
two surfaces.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design. Both passes recorded.*

| Principle | Verdict | Evidence |
| --- | --- | --- |
| **I. Tenant Isolation** | **Pass, with one justified exception** | `protectedProcedure` yields `ctx.tenantId` from the session, and every tenant-data query scopes by it at the call site. The exception is the operator console, which reads across tenants **by design** — see below. |
| **II. One Shared Tenant Space** | **Pass** | This feature adds no per-user space. The only per-user rows are the account, its sessions, and its settings — credentials and preferences, not knowledge. |
| **III. Spec Before Code** | **Pass** | `spec.md` written and clarified (five questions, session 2026-09-06) before this plan. |
| **IV. Types Are the Contract** | **Pass** | No `any`, no `@ts-expect-error`. The two-principal boundary is expressed in the type of each procedure builder rather than as a runtime check. No new environment variables, so the `src/env/` contract is unchanged. |
| **V. Every Change Lands Through a PR** | **Pass** | Branch `feature/22-admin-console-onboarding` cut from `main`; `pnpm check` before push; PR into `main` referencing #22. |

### The operator exception to Principle I, stated plainly

An operator reads every tenant. That is the feature. The constitution's real
requirement is that the scope be *visible in the query that needs it*, not that
every query carry a session tenant. Three things keep this honest:

1. `operatorProcedure` yields **no** `ctx.tenantId`. There is no ambient tenant to
   forget to apply.
2. Every operator procedure that touches tenant data takes `tenantId` as an
   explicit, validated input, so the cross-tenant read is written down in the
   query.
3. The two surfaces use different cookies and different session tables, so a
   tenant user's credential is not something the operator router could
   accidentally accept (R7).

This is recorded in Complexity Tracking rather than waved through.

## Project Structure

### Documentation (this feature)

```text
specs/022-admin-console-onboarding/
├── spec.md              # Feature specification (with Clarifications)
├── plan.md              # This file
├── research.md          # Phase 0 — R1..R10 technical decisions
├── data-model.md        # Phase 1 — schema changes and the first-login state machine
├── contracts/
│   └── trpc-api.md      # Phase 1 — routers, procedures, cookies, CLI
├── quickstart.md        # Phase 1 — manual end-to-end validation
├── checklists/
│   └── requirements.md  # Spec quality checklist (16/16)
└── tasks.md             # Created by /speckit-tasks, not by this command
```

### Source Code (repository root)

Only the paths this feature touches. Everything else is left alone.

```text
packages/db/
├── prisma/
│   ├── schema.prisma                     CHANGED  Language/SignInSurface/ThrottleScope enums;
│   │                                              Tenant.slug removed, defaultLanguage added;
│   │                                              User gains auth + onboarding fields;
│   │                                              Operator, UserSession, OperatorSession,
│   │                                              SignInThrottle added
│   └── migrations/                        NEW     the repository's first migration (R9)
└── src/index.ts                          unchanged

apps/web/src/
├── server/                                        server-only, per repository rule
│   ├── auth/                              NEW
│   │   ├── password.ts                            scrypt hash/verify, generate (R2)
│   │   ├── password.test.ts
│   │   ├── password-policy.ts                     FR-032a rules, one result type per rule
│   │   ├── password-policy.test.ts
│   │   ├── common-passwords.txt                   bundled deny-list (R3)
│   │   ├── session.ts                             create/resolve/revoke, both principals (R1)
│   │   ├── session.test.ts
│   │   ├── cookies.ts                             names, attributes, read/write helpers
│   │   ├── throttle.ts                            FR-022a..e against SignInThrottle (R5)
│   │   ├── throttle.test.ts
│   │   └── cli/
│   │       └── create-operator.ts                 FR-001..FR-005 (R6)
│   └── api/
│       ├── context.ts                    CHANGED  resolve both sessions; expose resHeaders
│       ├── trpc.ts                       CHANGED  onboardingProcedure, operatorProcedure;
│       │                                          protectedProcedure gains the FR-034 check
│       ├── root.ts                       CHANGED  register the new routers
│       └── routers/
│           ├── health.ts                 unchanged
│           ├── auth.ts                    NEW     tenant sign-in/out/me
│           ├── auth.test.ts               NEW
│           ├── onboarding.ts              NEW     confirmLanguage, replacePassword
│           ├── onboarding.test.ts         NEW
│           ├── account.ts                 NEW     the settings screen's procedures
│           ├── account.test.ts            NEW
│           ├── operator-auth.ts           NEW     operator sign-in/out/me
│           └── admin/
│               ├── tenants.ts             NEW     list/create/get + FR-013 counts
│               ├── tenants.test.ts        NEW
│               ├── users.ts               NEW     listByTenant/create/reissuePassword
│               └── users.test.ts          NEW
├── i18n/                                  NEW     R4
│   ├── messages/ja.ts                             source of truth for the key type
│   ├── messages/en.ts                             typed against ja.ts
│   ├── index.ts                                   getMessages(language), Language type
│   └── language-provider.tsx                      client context, seeded by the server
├── components/                            NEW     first shared components in the repo
│   ├── mark.tsx                                   the M4 product mark (FR-044, R10)
│   └── account-badge.tsx                          signed-in account display (FR-009, FR-041)
├── app/
│   ├── layout.tsx                        CHANGED  html lang from the resolved language
│   ├── globals.css                       unchanged (existing tokens are enough)
│   ├── (tenant)/                          NEW     tenant-facing surface
│   │   ├── layout.tsx                             session gate + first-login redirect (R8)
│   │   ├── page.tsx                       MOVED   from app/page.tsx — now the app root
│   │   ├── page.test.tsx                  MOVED   and rewritten for the signed-in shell
│   │   ├── sign-in/page.tsx                       FR-021, FR-043a..c
│   │   ├── welcome/page.tsx                       the two first-login steps
│   │   └── settings/page.tsx                      FR-036..FR-041
│   ├── (operator)/                        NEW     operator surface, Japanese only
│   │   └── admin/
│   │       ├── layout.tsx                         operator session gate (FR-007)
│   │       ├── sign-in/page.tsx
│   │       ├── page.tsx                           tenant list + registration (FR-010..FR-013)
│   │       └── tenants/[tenantId]/page.tsx        tenant detail + user list (FR-015..FR-020)
│   └── api/trpc/[trpc]/route.ts          CHANGED  pass resHeaders into the context
├── public/mark.svg                        NEW     square crop of docs/assets/banner.svg (R10)
└── e2e/
    ├── home.spec.ts                      CHANGED  the root is now the signed-in app
    ├── onboarding.spec.ts                 NEW     US1→US4→US6 end to end
    └── operator-console.spec.ts           NEW     US2, US3, US6

package.json                              CHANGED  operator:create script; tsx dev dependency
apps/web/package.json                     CHANGED  operator:create script
```

**Structure Decision**: the existing monorepo layout is kept exactly as it is.
The only structural addition is two Next.js **route groups** — `(tenant)` and
`(operator)` — which give each surface its own layout and therefore its own
session gate, without adding a second application or a second deployment. Route
groups do not appear in the URL, so the tenant application stays at `/` and the
console at `/admin`, matching the contract.

Two new top-level directories appear under `src/`: `i18n/` and `components/`.
Both are conventional for this stack and neither displaces anything.

## Implementation approach

### Layering, and what is responsible for what

| Layer | Responsibility | What it must never do |
| --- | --- | --- |
| `server/auth/` | Hashing, policy, tokens, cookies, throttling. Pure functions plus narrow Prisma calls. | Know about tRPC, React, or HTTP routing. |
| `server/api/context.ts` | Turn a request's cookies into at most one tenant-user session and at most one operator session. | Decide what a caller is *allowed* to do. |
| `server/api/trpc.ts` | Encode authorisation as builders. | Contain feature logic. |
| `server/api/routers/**` | Feature logic and validation, one router per bounded slice. | Read a session cookie directly, or scope a tenant query by anything but `ctx.tenantId`. |
| `app/(group)/layout.tsx` | Redirect on the way in, so no screen renders for the wrong principal. | Be the only place a rule is enforced — every rule is also enforced server-side in a procedure. |
| `app/**/page.tsx` | Render, and call procedures. | Hold authorisation logic. |
| `i18n/` | Message lookup by language. | Decide which language a user has. |

The rule behind the last column: **every authorisation rule is enforced in a
procedure, and the layout redirect is a convenience on top of it.** A layout that
forgets a check produces a wasted render; a procedure that forgets one produces a
breach. US4 scenario 9 and SC-007 are written against the procedure, not the
screen.

### Order of work

The dependency chain is real and worth following:

1. **Schema and migration** — nothing compiles against fields that do not exist.
2. **`server/auth/`** — pure modules with unit tests, no tRPC involvement yet.
3. **Context and procedure builders** — the point at which `ctx.session` stops
   being `null` and the existing `protectedProcedure` starts meaning something.
4. **Routers** — `auth`, then `onboarding`, then `account`, then the operator
   pair. Each with integration tests through `createCaller`.
5. **The CLI** — it depends only on step 2, but is worth doing after step 4 so it
   can be validated by signing in.
6. **i18n modules and shared components** — before screens, so no screen hard-codes
   a string.
7. **Screens**, in user-story order: operator console first (it is what creates
   the data every other story needs), then sign-in, then first login, then
   settings.
8. **E2E specs** last, once the flows they drive exist.

### Three decisions worth flagging before implementation

**Sign-in is a state transition, not a boolean.** `auth.signIn` returns where the
caller goes next — `language`, `password`, or `app` — computed from the state
machine in `data-model.md`. Putting that in one place stops three screens from
each deriving it and disagreeing.

**Generated passwords cross the wire exactly once.** They appear only in the
response of the procedure that generated them. No read procedure returns one, no
log line prints one, and nothing persists one in plaintext. This is a property
worth asserting in a test rather than trusting.

**The first-login gate lives in `protectedProcedure`.** Adding the
`firstLoginCompletedAt` check there means every present and future application
procedure inherits FR-034 without remembering it — including the chat procedures
of issue #23.

## Impact on data, API, UI and state

**Data.** Detailed in `data-model.md`. In summary: one new enum trio, four new
models (`Operator`, `UserSession`, `OperatorSession`, `SignInThrottle`), `Tenant`
loses `slug` and gains `defaultLanguage`, and `User` gains five fields. Counts for
FR-013 are aggregates, not counter columns.

**API.** Detailed in `contracts/trpc-api.md`. Six new routers, three new procedure
builders, one changed builder. `health` is untouched. The `AppRouter` type export
is unchanged in shape, so the existing client provider needs no edit.

**UI.** Two route groups, twelve screens. The existing dark-tone tokens in
`globals.css` cover everything; no palette work. The M4 mark is a new SVG derived
from the existing banner.

**State management.** No new library. Server state stays in TanStack Query through
the existing tRPC React provider. The only client state this feature adds is the
language context (R4) and the sign-in screen's device language toggle, which is a
cookie rather than state. Session state is server-side by construction.

## Compatibility with what already exists

| Existing thing | What happens | Why it is safe |
| --- | --- | --- |
| `protectedProcedure` in `trpc.ts` | Kept, with the FR-034 check added | Its documented contract — authenticated, yields `ctx.tenantId` — is unchanged and now actually holds. The comment about per-query scoping stays true. |
| `Session` interface in `context.ts` | Kept as `{ userId, tenantId }` | It was written as a placeholder of exactly the right shape. The `TODO(#auth)` comment is what this feature removes. |
| `health` router | Untouched | `publicProcedure` is unchanged. |
| `app/page.tsx` and `page.test.tsx` | Move into `(tenant)/` and are rewritten | The root becomes the signed-in application, so the current marketing copy no longer belongs there. **This is a deliberate behaviour change** and the one place this feature alters something that already worked. |
| `e2e/home.spec.ts` | Rewritten | It asserts the old marketing root. Its replacement asserts the redirect to sign-in. |
| `Tenant.slug` | Removed | Nothing reads it; Q1 established that nothing routes by tenant. |
| `User.role` | Left in place, unused | The spec's Assumptions say so explicitly. Removing it is out of scope and would touch issue #23's ground. |
| `pnpm db:push` workflow | Becomes `pnpm db:migrate` | R9. No deployed database exists, so the switch costs one `pnpm db:reset` locally. `CLAUDE.md` already documents both commands. |
| `src/env/` contract | Untouched | This feature adds no environment variable. |

## Test strategy

Tests live next to the code as `*.test.ts(x)`; E2E specs in `apps/web/e2e`. The
existing Vitest and Playwright configuration needs no change.

**Unit — `server/auth/`.** The security primitives, tested as pure functions:
scrypt round-trips and rejects a wrong password; the encoding carries its
parameters; `timingSafeEqual` is used. Every rule in FR-032a gets a case, in both
directions, including that a generated password always passes (FR-032c). Token
generation produces enough entropy and stores only a hash.

**Integration — routers through `createCaller`.** This is where the spec's
acceptance scenarios live, because they are statements about procedures:

- Sign-in returns the right `next` for each state in the first-login table.
- A wrong password, an unknown address and a throttled attempt are
  indistinguishable to the caller (FR-022, FR-022e).
- Five failures throttle; a success resets the counter; the window releases
  (FR-022c).
- `protectedProcedure` refuses a user whose first login is unfinished (FR-034).
- `operatorProcedure` refuses a tenant-user cookie, and vice versa (FR-008).
- A password change ends other sessions and spares the caller's (FR-023c).
- A reissue ends sessions and leaves `firstLoginCompletedAt` alone (FR-035).
- **Tenant isolation (SC-007)**: a caller in tenant A is denied data from tenant
  B by calling the procedure directly, not by driving the UI.
- **Privilege escalation (FR-041)**: no account procedure accepts a user id, so
  the test asserts the *shape* — an attempt to act on another user has no way to
  be expressed.

**Component — screens.** Testing Library against the pieces with real logic: the
language step pre-selects the operator's choice (FR-028); the password step names
the rule that failed (FR-032b); the settings screen renders the identifier and
address as non-editable (FR-037); the sign-in screen renders in both languages
(FR-043c).

**E2E — Playwright.** Two specs, each following a quickstart section:
`onboarding.spec.ts` runs bootstrap → register → first login → operator sees the
flag flip (SC-001, SC-002, SC-006); `operator-console.spec.ts` covers tenant and
user registration including the duplicate-address refusal. `home.spec.ts` is
rewritten to assert the unauthenticated redirect.

**Not tested**: the exact scrypt cost parameters (a tuning value, not a
behaviour), and the visual rendering of the mark.

## Out of scope for this plan

Everything the spec excludes, and three things worth naming because they are
plausible next steps that this plan deliberately does not take:

- **No refactor of `health`, the tRPC provider, or the existing env modules.**
  They work and this feature does not need them changed.
- **No component library, design system, or CSS work beyond using the existing
  tokens.** Twelve screens do not justify it, and the palette already exists.
- **No audit trail of operator actions.** It is in the spec's Open Questions;
  `createdAt` is what this feature records.
- **No background job** for expiring sessions or throttle rows. Both are handled
  opportunistically on read (R1, R5), written down so it is a decision rather
  than a gap.
- **Nothing from issue #23.** No chat, no history, no search. `conversationCount`
  reads a table that stays empty.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Operator procedures read across tenants, unlike every other procedure (Principle I) | The operator console exists to see every tenant; FR-013 and FR-020 are cross-tenant by definition | Scoping operator reads to one tenant would make the console unable to list tenants at all. Mitigated by `operatorProcedure` yielding no ambient `tenantId`, so every cross-tenant read names its tenant explicitly. |
| Two session tables rather than one polymorphic table | FR-008 is a security boundary; two tables make crossing it unrepresentable rather than merely checked | One table with two nullable foreign keys means every read must prove which principal it got, forever, in code that is easy to get subtly wrong. The duplication is ~15 lines of schema. |
| Hand-rolled authentication instead of a library | R1: two principal types, a blocking onboarding state, and server-side revocation each fight the abstraction; no provider ecosystem is in scope | Auth.js would need two instances or a discriminated user table, and its session callbacks are the wrong place for a blocking first-login gate. Lucia, the library closest to this shape, was deprecated in favour of writing exactly these ~150 lines. |
| A bundled 10,000-entry password deny-list in the repository | FR-032a requires a dictionary check and the spec forbids outbound requests | A strength estimator like zxcvbn cannot produce the specific failed-rule message FR-032b requires, and is a far larger dependency. |
