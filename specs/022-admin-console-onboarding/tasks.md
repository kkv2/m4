---

description: "Task breakdown for issue #22 — operator console, tenant onboarding and first login"
---

# Tasks: Operator Console, Tenant & User Onboarding, First Login

**Input**: Design documents from `/specs/022-admin-console-onboarding/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/trpc-api.md](./contracts/trpc-api.md)

**Tests**: Included. The spec carries acceptance scenarios for every story and
`plan.md` defines a test strategy, so test work is part of the task that
introduces the behaviour rather than a separate phase.

**Organization**: Grouped by user story so each can be implemented, tested and
demonstrated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel — different files, no dependency on unfinished work
- **[Story]**: the user story from `spec.md` this task serves
- Every task names the exact files it may touch

Each task carries a detail block: **Purpose**, **Spec**, **Touches**, **Done
when**, **Not in this task**, **Depends on**.

## Path conventions

pnpm workspace monorepo. `apps/web` is the Next.js app and tRPC BFF, `packages/db`
is Prisma. Imports inside `apps/web` use the `~/` alias for `src/`.

---

## Phase 1: Setup

**Purpose**: the two shared prerequisites that touch configuration and assets.

- [X] T001 Add the `tsx` dev dependency and the `operator:create` script alias in `package.json` and `apps/web/package.json`

  - **Purpose**: give the repository a way to run a TypeScript script, which the operator bootstrap CLI needs.
  - **Spec**: FR-001 · research.md R6
  - **Touches**: `package.json`, `apps/web/package.json`, `pnpm-lock.yaml`
  - **Done when**: `pnpm operator:create` dispatches to `@m4/web` and fails with a usage message (the script file does not exist yet, so a placeholder that exits non-zero is acceptable); `pnpm install` is clean.
  - **Not in this task**: the CLI logic itself, any password handling.
  - **Depends on**: nothing.

- [X] T002 [P] Create the product mark at `apps/web/public/mark.svg`, cropped from `docs/assets/banner.svg`

  - **Purpose**: produce the square icon-scale asset both surfaces will display.
  - **Spec**: FR-044, FR-045 · research.md R10
  - **Touches**: `apps/web/public/mark.svg`
  - **Done when**: a square-viewBox SVG renders the M4 wordmark legibly at 32px against the dark base tone, reusing the banner's gradients; `docs/assets/banner.svg` is unmodified.
  - **Not in this task**: the React component that renders it, any layout wiring.
  - **Depends on**: nothing.

---

## Phase 2: Foundational (blocking prerequisites)

**⚠️ No user story work can begin until this phase is complete.** Every story
needs the schema, the auth primitives and the procedure builders.

- [X] T003 Apply every schema change in `packages/db/prisma/schema.prisma`

  - **Purpose**: make the data model match `data-model.md` in one coherent edit.
  - **Spec**: FR-010 to FR-020, FR-022a-e, FR-023a-c · data-model.md
  - **Touches**: `packages/db/prisma/schema.prisma`
  - **Done when**: `Language`, `SignInSurface` and `ThrottleScope` enums exist; `Tenant` has lost `slug` and gained `defaultLanguage Language @default(JA)`; `User` has `email @unique`, non-nullable `name`, `passwordHash`, `language`, `languageConfirmedAt`, `mustChangePassword`, `firstLoginCompletedAt`; `Operator`, `UserSession`, `OperatorSession` and `SignInThrottle` exist with the indexes and `@@map` names from `data-model.md`; `pnpm format` leaves the file unchanged.
  - **Not in this task**: the migration, any TypeScript. `Attachment`, `Document`, `DocumentChunk`, `Conversation`, `Message` and `User.role` stay exactly as they are.
  - **Depends on**: nothing.

- [X] T004 Generate the repository's first migration under `packages/db/prisma/migrations/` and regenerate the client

  - **Purpose**: move the project from `db:push` to a real migration history.
  - **Spec**: research.md R9 · data-model.md "Migration"
  - **Touches**: `packages/db/prisma/migrations/**` (new), generated client output
  - **Done when**: `pnpm db:reset && pnpm db:up && pnpm db:migrate` produces one initial migration that creates every table, and `pnpm db:deploy` applies it to a clean database; `pnpm typecheck` passes against the regenerated client.
  - **Not in this task**: seed data, any application code.
  - **Depends on**: T003.

- [X] T005 [P] Implement scrypt hashing in `apps/web/src/server/auth/password.ts` with tests

  - **Purpose**: the one place that turns a password into a stored value and back into a verdict.
  - **Spec**: FR-002, FR-017, FR-023 · research.md R2
  - **Touches**: `apps/web/src/server/auth/password.ts`, `apps/web/src/server/auth/password.test.ts`
  - **Done when**: `hashPassword`, `verifyPassword` and `generatePassword` are exported; the stored string carries its own parameters so they can be raised later; verification uses `timingSafeEqual`; tests cover a correct round-trip, a wrong password, and that two hashes of the same input differ.
  - **Not in this task**: the strength policy, anything that reads or writes the database.
  - **Depends on**: nothing.

- [X] T006 [P] Implement the password policy in `apps/web/src/server/auth/password-policy.ts` with its deny-list and tests

  - **Purpose**: FR-032a as a pure function returning which rule failed, so FR-032b's message has something to name.
  - **Spec**: FR-032a, FR-032b, FR-032c · research.md R3
  - **Touches**: `apps/web/src/server/auth/password-policy.ts`, `apps/web/src/server/auth/password-policy.test.ts`, `apps/web/src/server/auth/common-passwords.ts`
  - **Done when**: the function returns a discriminated result naming the failed rule (too short, too common, matches your address, matches your display name) or success; the deny-list carries its source and licence in a header comment (a TypeScript module rather than a `.txt` read from disk — Next.js bundles server code, so a path derived from `import.meta.url` does not survive the build); tests cover each rule in both directions and assert that a generated password always passes.
  - **Not in this task**: the "must differ from the issued password" rule (that needs a hash comparison and belongs to the onboarding router), any UI copy.
  - **Depends on**: nothing. *(Reads `generatePassword` from T005 only in its test — write the test to import it, and sequence after T005 if that is inconvenient.)*

- [X] T007 [P] Define session cookie names and attributes in `apps/web/src/server/auth/cookies.ts`

  - **Purpose**: keep cookie names and flags in one module so no route invents its own.
  - **Spec**: contracts/trpc-api.md "Cookies" · research.md R7
  - **Touches**: `apps/web/src/server/auth/cookies.ts`
  - **Done when**: `m4_session`, `m4_operator_session` and `m4_signin_language` are declared with the attributes from the contract; helpers read a cookie from a `Headers` and serialise a `Set-Cookie` value; `Secure` is set outside development.
  - **Not in this task**: creating or resolving sessions, reading the language preference in a page.
  - **Depends on**: nothing.

- [X] T008 Implement the session layer in `apps/web/src/server/auth/session.ts` with tests

  - **Purpose**: create, resolve, extend and revoke sessions for both principal types.
  - **Spec**: FR-021, FR-023a, FR-023b, FR-023c · research.md R1
  - **Touches**: `apps/web/src/server/auth/session.ts`, `apps/web/src/server/auth/session.test.ts`
  - **Done when**: creating a session returns the plaintext token once and stores only its SHA-256 hash; resolving an unexpired token returns the principal and slides `expiresAt` only when more than an hour has passed since `lastUsedAt`; an expired token resolves to null; `revokeOtherSessions(userId, keepTokenHash)` deletes every other row; operator and tenant-user sessions use their own tables and cannot resolve each other.
  - **Not in this task**: tRPC wiring, cookie emission, throttling.
  - **Depends on**: T004, T007.

- [X] T009 Implement sign-in throttling in `apps/web/src/server/auth/throttle.ts` with tests

  - **Purpose**: FR-022a-e as a module the sign-in procedures call before comparing a password.
  - **Spec**: FR-022a, FR-022b, FR-022c, FR-022d, FR-022e · research.md R5
  - **Touches**: `apps/web/src/server/auth/throttle.ts`, `apps/web/src/server/auth/throttle.test.ts`
  - **Done when**: failures are counted per `(surface, scope, key)`; the threshold is 5 within 15 minutes and the cooling-off is 15 minutes; a window older than the cooling-off resets in place rather than accumulating; a successful sign-in clears the ACCOUNT counter; nothing in the module distinguishes a registered address from an unregistered one; tests cover the trip, the release and the reset.
  - **Not in this task**: extracting the client address from a request, the sign-in procedures themselves.
  - **Depends on**: T004.

- [X] T010 Resolve both sessions in `apps/web/src/server/api/context.ts` and pass `resHeaders` from `apps/web/src/app/api/trpc/[trpc]/route.ts`

  - **Purpose**: turn a request's cookies into principals, and give procedures a way to emit `Set-Cookie`.
  - **Spec**: contracts/trpc-api.md "Procedure builders", "Cookies"
  - **Touches**: `apps/web/src/server/api/context.ts`, `apps/web/src/app/api/trpc/[trpc]/route.ts`
  - **Done when**: `Context` exposes `session` (unchanged `{ userId, tenantId }` shape), the loaded `user`, `operator`, `resHeaders` and the client address; the `TODO(#auth)` comment is gone; a request with no cookies still yields a valid context with nulls.
  - **Not in this task**: authorisation decisions — the context reports what a caller *is*, never what it may do.
  - **Depends on**: T008.

- [X] T011 Add the three procedure builders in `apps/web/src/server/api/trpc.ts`

  - **Purpose**: encode authorisation in the type system, so a handler cannot confuse the two principals.
  - **Spec**: FR-007, FR-008, FR-034 · contracts/trpc-api.md · research.md R7
  - **Touches**: `apps/web/src/server/api/trpc.ts`
  - **Done when**: `onboardingProcedure` requires a tenant-user session; `protectedProcedure` additionally requires `firstLoginCompletedAt != null` and still yields `ctx.tenantId`; `operatorProcedure` requires an operator session and yields **no** `tenantId`; `publicProcedure` and the existing comments about per-query tenant scoping are untouched.
  - **Not in this task**: any router, any feature logic.
  - **Depends on**: T010.

- [X] T012 [P] Add the message dictionaries and language provider under `apps/web/src/i18n/`

  - **Purpose**: one typed lookup for Japanese and English so no screen hard-codes a string.
  - **Spec**: FR-039, FR-043, FR-043c · research.md R4
  - **Touches**: `apps/web/src/i18n/messages/ja.ts`, `apps/web/src/i18n/messages/en.ts`, `apps/web/src/i18n/index.ts`, `apps/web/src/i18n/language-provider.tsx`
  - **Done when**: `ja.ts` is the source of the message key type and `en.ts` is typed against it, so a missing key fails `pnpm typecheck`; `getMessages(language)` works on the server; `LanguageProvider` supplies messages to client components; the initial key set covers sign-in, first login and settings.
  - **Not in this task**: operator console copy (Japanese only, and it may use these dictionaries or literals), translating screens that do not exist yet.
  - **Depends on**: nothing.

- [X] T013 [P] Add `<Mark />` and `<AccountBadge />` under `apps/web/src/components/`

  - **Purpose**: the two pieces both surfaces put in their layout.
  - **Spec**: FR-009, FR-041, FR-044, FR-045
  - **Touches**: `apps/web/src/components/mark.tsx`, `apps/web/src/components/account-badge.tsx`
  - **Done when**: `<Mark />` renders `public/mark.svg` at a given size with the accessible name "M4"; `<AccountBadge />` renders a display name and email address passed as props; both use existing tokens from `globals.css` and add no new colour.
  - **Not in this task**: fetching the account (the badge takes props), wiring either into a layout.
  - **Depends on**: T002.

- [X] T013a Give CI's `verify` job a database, and load the workspace `.env` into Vitest

  - **Purpose**: unblock the integration tests the plan's test strategy is built on.
  - **Spec**: plan.md "Test strategy" · SC-007
  - **Touches**: `.github/workflows/ci.yml`, `apps/web/vitest.setup.ts`
  - **Done when**: the `verify` job runs a PostgreSQL service and applies migrations before `pnpm test`; `vitest.setup.ts` loads the workspace-root `.env` so `DATABASE_URL` reaches `@m4/db`; both CI jobs use `db:deploy` rather than `db:push`, so the migration history is what gets exercised.
  - **Not in this task**: any cloud infrastructure — this is CI configuration, which the spec's infrastructure exclusion does not cover.
  - **Depends on**: T004.
  - **Note**: not in the original breakdown. The plan assumed integration tests could run in CI, but the `verify` job had no database and its comment said unit tests never open a connection. Found while writing T008's tests and corrected here, per the amended rule that an implementation which proves the plan wrong fixes it in its own pull request.

- [X] T013b Add database fixtures at `apps/web/src/server/testing/fixtures.ts`

  - **Purpose**: give database-backed tests tenants, users and operators without each test writing its own setup.
  - **Spec**: plan.md "Test strategy"
  - **Touches**: `apps/web/src/server/testing/fixtures.ts`
  - **Done when**: fixtures create tenants, tenant users (with a known plaintext password) and operators, each with a random suffix so test files can run in parallel against one database; nothing truncates a table or assumes an empty one.
  - **Not in this task**: fixtures for chats or documents — issue #23's ground.
  - **Depends on**: T004, T005.
  - **Note**: not in the original breakdown; extracted once T008 and T009 both needed the same setup.
---

## Phase 3: User Story 1 — Bootstrap the first operator account (P1)

**Goal**: an operator account exists, created only from the command line.

**Independent test**: run the command against an empty database and sign in later with what it printed.

- [X] T014 [US1] Implement the operator bootstrap CLI in `apps/web/src/server/auth/cli/create-operator.ts`

  - **Purpose**: FR-001 to FR-005 — the only way an operator comes into existence.
  - **Spec**: US1 · FR-001, FR-002, FR-003, FR-004, FR-005
  - **Touches**: `apps/web/src/server/auth/cli/create-operator.ts`, `apps/web/src/server/auth/cli/create-operator.test.ts`, `apps/web/package.json` (point the script at the real file)
  - **Done when**: `pnpm operator:create -- ops@example.com` creates one operator, prints the generated password exactly once, and exits 0; running it again with the same address exits non-zero with a clear message and creates nothing; the email address is validated; the underlying `createOperator()` function is exported and unit-tested separately from the argv parsing.
  - **Not in this task**: any HTTP route (FR-004 forbids one), operator sign-in.
  - **Depends on**: T001, T004, T005.
  - **Notes from implementation**: the module imports `~/env/server` before
    anything else, because `@m4/db` builds its client from `DATABASE_URL` at
    import time and a CLI run by tsx has nobody else to load the workspace
    `.env`. The runner also strips a literal `--`, which `pnpm operator:create --
    <email>` forwards through both the root script and the workspace filter.

---

## Phase 4: User Story 2 — Operator signs in and registers a tenant (P1)

**Goal**: an operator reaches a Japanese-only console and creates the first tenant.

**Independent test**: sign in with the bootstrapped credentials, register a tenant, see it listed with its identifier.

- [X] T015 [US2] Implement `apps/web/src/server/api/routers/operator-auth.ts` with tests

  - **Purpose**: operator sign-in, sign-out and identity.
  - **Spec**: US2 · FR-007, FR-008, FR-009, FR-022a-e, FR-023b
  - **Touches**: `apps/web/src/server/api/routers/operator-auth.ts`, `apps/web/src/server/api/routers/operator-auth.test.ts`, `apps/web/src/server/api/root.ts`
  - **Done when**: `signIn` throttles before comparing, sets `m4_operator_session`, and returns one indistinguishable error for every failure cause; `signOut` deletes the session; `me` returns id and email; tests assert a tenant-user cookie cannot authenticate an operator procedure.
  - **Not in this task**: any tenant or user management procedure.
  - **Depends on**: T011, T009.

- [X] T016 [US2] Implement `apps/web/src/server/api/routers/admin/tenants.ts` with tests

  - **Purpose**: register and review tenants, with the counts FR-013 asks for.
  - **Spec**: US2 · FR-010, FR-011, FR-012, FR-013, FR-014
  - **Touches**: `apps/web/src/server/api/routers/admin/tenants.ts`, `apps/web/src/server/api/routers/admin/tenants.test.ts`, `apps/web/src/server/api/root.ts`
  - **Done when**: `create` validates a non-empty trimmed name and a language, defaulting to `JA`; `list` and `get` return the identifier plus user and conversation counts as aggregates; the conversation count is `0`, not null, on an empty database; every procedure uses `operatorProcedure` and names its `tenantId` explicitly where it reads tenant data.
  - **Not in this task**: user management (that is US3), any deletion (FR-046).
  - **Depends on**: T011.

- [X] T017 [US2] Add the operator route group at `apps/web/src/app/(operator)/admin/layout.tsx` and `sign-in/page.tsx`

  - **Purpose**: the console's shell and its gate.
  - **Spec**: US2 · FR-006, FR-007, FR-009, FR-044
  - **Touches**: `apps/web/src/app/(operator)/admin/layout.tsx`, `apps/web/src/app/(operator)/admin/sign-in/page.tsx`
  - **Done when**: the layout redirects an unauthenticated request to `/admin/sign-in` without rendering data; every string is Japanese and no language control exists; the layout shows `<Mark />` and the signed-in operator via `<AccountBadge />`; the sign-in screen reports failure without revealing whether the address exists.
  - **Not in this task**: the tenant list or any tenant screen.
  - **Depends on**: T015, T013.

- [X] T018 [US2] Build the tenant list and registration screen at `apps/web/src/app/(operator)/admin/page.tsx`

  - **Purpose**: the console's home — register a tenant, see every tenant with its identifier and counts.
  - **Spec**: US2 · FR-010 to FR-014
  - **Touches**: `apps/web/src/app/(operator)/admin/page.tsx`, `apps/web/src/app/(operator)/admin/page.test.tsx`
  - **Done when**: the registration form pre-selects Japanese; an empty display name is refused with a message; the list shows each tenant's identifier, user count and chat count; an empty list shows an empty state rather than an error; the component test asserts the Japanese default and the validation message.
  - **Not in this task**: the tenant detail screen.
  - **Depends on**: T016, T017.
  - **Notes from implementation**:
    - The route group is split in two — `(operator)/(signed-in)/` and
      `(operator)/(anonymous)/` — because a gate that redirects to a page it
      also guards is an infinite redirect. Route groups do not appear in the
      URL, so both still resolve under `/admin`.
    - The screens are Client Components calling tRPC over HTTP. Sign-in has to
      be: the session cookie is set from `ctx.resHeaders`, and a server-side
      `createCaller` has no HTTP response to attach it to. The reads follow suit
      rather than giving the same data two paths.
    - `pnpm typecheck` now runs `next typegen` first. `typedRoutes` derives
      route literal types from the route tree, which does not exist until
      something generates it — the first `redirect("/admin")` made that visible.
    - Operator console copy lives in `src/i18n/messages/admin.ts`, outside the
      `Messages` type. That type is the contract every language must satisfy,
      and the console is Japanese-only (FR-006); adding console keys to it would
      oblige `en.ts` to translate screens never shown in English.

- [X] T018a Fix three defects that only running the application revealed

  - **Purpose**: none of these was visible to lint, typecheck or the unit tests.
  - **Spec**: FR-006, FR-007, FR-022 · plan.md "Layering"
  - **Touches**: `apps/web/src/server/auth/cookies.ts`, both form components, `.github/workflows/ci.yml`, `specs/022-admin-console-onboarding/contracts/trpc-api.md`
  - **Done when**:
    1. **The operator cookie is `Path=/`, not `Path=/admin`.** The contract
       specified `/admin`, which looked tidier and meant the cookie never
       reached `/api/trpc` — the console signed in successfully and then got
       `UNAUTHORIZED` from every procedure. The operator/tenant boundary is held
       by the separate cookie names and session tables, not by path scoping. The
       contract is corrected too.
    2. **Both forms are `method="post"`.** A form with no method submits as GET.
       With JavaScript not yet hydrated, the sign-in form put the password in
       the query string — and from there into history, the server log and the
       Referer header.
    3. **CI runs `pnpm build`.** A Client Component had imported `@m4/db`,
       dragging Prisma and node-postgres into the browser bundle. Lint,
       typecheck and every test passed; only the build failed. The server
       boundary is a stated invariant with no other automated guard.
  - **Not in this task**: making `~/lib/trpc-client` use a relative URL instead
    of `NEXT_PUBLIC_APP_URL` — a real latent limitation, but pre-existing and
    not in this issue's way.
  - **Depends on**: T017, T018.
  - **Note**: not in the original breakdown; all three were found by signing in
    to the running console and watching what happened.

---

## Phase 5: User Story 3 — Operator registers a tenant user (P1)

**Goal**: a tenant user exists and the operator has a password to hand over.

**Independent test**: register a user under a tenant, capture the shown password, and use it in US4.

- [X] T019 [US3] Implement `apps/web/src/server/api/routers/admin/users.ts` with tests

  - **Purpose**: register users, list them, reissue a lost password.
  - **Spec**: US3 · FR-015 to FR-020, FR-024, FR-035, FR-023c
  - **Touches**: `apps/web/src/server/api/routers/admin/users.ts`, `apps/web/src/server/api/routers/admin/users.test.ts`, `apps/web/src/server/api/root.ts`
  - **Done when**: `create` generates the password, returns it once, and refuses an address registered to **any** tenant with a message that does not name the holding tenant; `listByTenant` returns the identifier and first-login status; `reissuePassword` generates a new password, ends that user's sessions, and leaves `firstLoginCompletedAt` untouched; a test asserts no read procedure ever returns a password or a hash.
  - **Not in this task**: editing an email address (FR-018 forbids it), deleting a user (FR-046).
  - **Depends on**: T016, T005, T008.

- [X] T020 [US3] Build the tenant detail screen at `apps/web/src/app/(operator)/admin/tenants/[tenantId]/page.tsx`

  - **Purpose**: the screen where users are registered and reviewed.
  - **Spec**: US3, US6 · FR-015, FR-016, FR-017, FR-018, FR-020, FR-024
  - **Touches**: `apps/web/src/app/(operator)/admin/tenants/[tenantId]/page.tsx`, and its `.test.tsx`
  - **Done when**: the registration form pre-selects the tenant's default language; the generated password is displayed once after registration in a form the operator can copy, and is not re-rendered on a later visit; the user list shows each identifier, the email address as non-editable, and first-login status; reissue is available per user; an empty tenant shows an empty state.
  - **Not in this task**: cross-tenant navigation beyond a link back to the list.
  - **Depends on**: T019, T018.
  - **Notes from implementation**:
    - The generated password lives in component state and nowhere else. It is
      never written to the query cache, so no refetch can bring it back — which
      is what makes "shown once" true rather than merely intended.
    - The "cannot be changed later" hint sits outside the `<label>`. Inside it,
      it became part of the field's accessible name.
    - `admin.users` has no `update` and no `delete`. A test asserts the router's
      procedure list, so adding either should fail and send whoever added it to
      the spec (FR-018, FR-046).

---

## Phase 6: User Story 4 — Tenant user completes first login (P1)

**Goal**: a person with issued credentials reaches the application under their own password.

**Independent test**: sign in with fresh credentials, complete both steps, sign out, and confirm the new password works and the issued one does not.

- [X] T021 [US4] Implement `apps/web/src/server/api/routers/auth.ts` with tests

  - **Purpose**: tenant sign-in, sign-out, and the identity the shell displays.
  - **Spec**: US4 · FR-021, FR-022, FR-022a-e, FR-023b, FR-041
  - **Touches**: `apps/web/src/server/api/routers/auth.ts`, `apps/web/src/server/api/routers/auth.test.ts`, `apps/web/src/server/api/root.ts`
  - **Done when**: `signIn` takes only an address and a password, throttles first, sets `m4_session`, and returns `next` as `"language" | "password" | "app"` computed from the state table in `data-model.md`; every failure cause is indistinguishable to the caller; `me` returns the account and its tenant, never a hash; tests cover each `next` value and assert an operator cookie cannot authenticate a tenant procedure.
  - **Not in this task**: the onboarding transitions themselves.
  - **Depends on**: T011, T009.

- [X] T022 [US4] Implement `apps/web/src/server/api/routers/onboarding.ts` with tests

  - **Purpose**: the two first-login transitions, and the point where first login becomes complete.
  - **Spec**: US4 · FR-027 to FR-035, FR-023c
  - **Touches**: `apps/web/src/server/api/routers/onboarding.ts`, `apps/web/src/server/api/routers/onboarding.test.ts`, `apps/web/src/server/api/root.ts`
  - **Done when**: `confirmLanguage` writes `language` and `languageConfirmedAt`; `replacePassword` applies the policy, rejects a password equal to the issued one, clears `mustChangePassword`, sets `firstLoginCompletedAt` and revokes the user's other sessions; each procedure refuses if its step is already done; a test asserts a user mid-flow is rejected by `protectedProcedure` but accepted by `onboardingProcedure`.
  - **Not in this task**: the screens.
  - **Depends on**: T021, T006, T005.

- [X] T023 [US4] Add the tenant route group at `apps/web/src/app/(tenant)/`, moving the existing root page into it

  - **Purpose**: the application shell and its gate — and the one deliberate behaviour change in this feature.
  - **Spec**: US4 · FR-034, FR-039, FR-041, FR-044 · plan.md "Compatibility"
  - **Touches**: `apps/web/src/app/(tenant)/layout.tsx`, `apps/web/src/app/(tenant)/page.tsx` (moved from `apps/web/src/app/page.tsx`), `apps/web/src/app/(tenant)/page.test.tsx` (moved and rewritten), `apps/web/src/app/layout.tsx`
  - **Done when**: `apps/web/src/app/page.tsx` no longer exists and `/` resolves through the group without a route collision; an unauthenticated request redirects to `/sign-in`; a user with first login unfinished redirects to `/welcome`; the shell renders `<Mark />` and `<AccountBadge />` and the app is in the user's language; the root layout sets `html lang` from the resolved language; the moved test asserts the signed-in shell instead of the old marketing copy.
  - **Not in this task**: the sign-in or welcome screens themselves, `e2e/home.spec.ts` (that is T029).
  - **Depends on**: T021, T012, T013.

- [X] T024 [US4] Build the tenant sign-in screen at `apps/web/src/app/(tenant)/sign-in/page.tsx`

  - **Purpose**: the only unauthenticated screen a tenant user sees, in either language.
  - **Spec**: US4 · FR-021, FR-022, FR-043a, FR-043b, FR-043c
  - **Touches**: `apps/web/src/app/(tenant)/sign-in/page.tsx`, and its `.test.tsx`
  - **Done when**: the screen opens in Japanese with a control to switch to English; the choice writes `m4_signin_language` and a later visit from the same device honours it; validation and throttling messages exist in both languages; a failure message never reveals whether the address exists; on success the caller is routed by the `next` value from `auth.signIn`.
  - **Not in this task**: the first-login steps; the account language overriding this preference (that is T023's shell).
  - **Depends on**: T023, T021.

- [X] T025 [US4] Build the first-login screen at `apps/web/src/app/(tenant)/welcome/page.tsx`

  - **Purpose**: the two blocking steps, in order, resumable.
  - **Spec**: US4 · FR-027 to FR-034
  - **Touches**: `apps/web/src/app/(tenant)/welcome/page.tsx`, and its `.test.tsx`
  - **Done when**: the language step pre-selects the operator-assigned language and the password step follows it in the chosen language; a rejected password names the rule that failed; a user who abandons the flow resumes at the unfinished step; a user who has completed first login is redirected away.
  - **Not in this task**: changing a password from settings (that is US5).
  - **Depends on**: T022, T023.
  - **Notes from implementation**:
    - The tenant surface needs **three** route groups, not two:
      `(anonymous)/sign-in`, `(onboarding)/welcome` and `(signed-in)/`. The
      application layout redirects an unfinished user to `/welcome`, so welcome
      cannot live under it — a gate that redirects to a page it also guards is
      an infinite redirect.
    - `MINIMUM_PASSWORD_LENGTH` and the sign-in language cookie's name moved to
      `src/lib/`. The screens quote both, and a Client Component importing
      `~/server/` would drag the deny-list and the cookie helpers into the
      browser bundle.
    - The language step previews its own choice: picking English re-renders the
      step in English before it is confirmed.

- [X] T025a Assert the server boundary rather than trusting it

  - **Purpose**: `CLAUDE.md` states that server-only code never reaches a Client
    Component, and nothing checked it.
  - **Spec**: plan.md "Layering" · CLAUDE.md "Boundaries"
  - **Touches**: `apps/web/src/server-boundary.test.ts`
  - **Done when**: a test scans every `"use client"` file and fails if it imports
    `~/server/` or `@m4/db` at runtime; type-only imports are allowed, because
    they are erased and are how tRPC gives the client its `AppRouter` type.
  - **Not in this task**: an ESLint rule — a test reports the offending file and
    what to do about it, which is what was wanted here.
  - **Depends on**: T023.
  - **Note**: not in the original breakdown. Issue #27 found a Client Component
    importing `@m4/db`, caught only because Prisma cannot be bundled; this issue
    then found one importing the cookie helpers, which *would* have bundled
    silently. Two in two issues is a pattern, so it is now checked.

---

## Phase 7: User Story 5 — Tenant user manages their own account (P2)

**Goal**: a user can read their identifiers and change their own name, language and password.

**Independent test**: open settings from both the control and the shortcut, change each field, and confirm each persists across a fresh sign-in.

- [X] T026 [US5] Implement `apps/web/src/server/api/routers/account.ts` with tests

  - **Purpose**: the settings procedures, shaped so acting on another user is unrepresentable.
  - **Spec**: US5 · FR-036 to FR-041, FR-023c
  - **Touches**: `apps/web/src/server/api/routers/account.ts`, `apps/web/src/server/api/routers/account.test.ts`, `apps/web/src/server/api/root.ts`
  - **Done when**: `get`, `updateDisplayName`, `updateLanguage` and `changePassword` all act on `ctx.session.userId` and **none accepts a user id as input**; `changePassword` requires the current password, applies the policy and revokes other sessions while sparing the caller's; a test asserts the procedures' input shapes leave no way to name another user.
  - **Not in this task**: changing an email address (FR-018).
  - **Depends on**: T011, T006, T008.

- [X] T027 [US5] Build the settings screen at `apps/web/src/app/(tenant)/(signed-in)/settings/page.tsx` with its keyboard shortcut

  - **Purpose**: FR-036's two ways in, and the four fields behind them.
  - **Spec**: US5 · FR-036, FR-037, FR-038, FR-040, FR-041
  - **Touches**: `apps/web/src/app/(tenant)/(signed-in)/settings/`, `apps/web/src/app/(tenant)/(signed-in)/settings-link.tsx`, and the shell in `apps/web/src/app/(tenant)/(signed-in)/layout.tsx`
  - **Done when**: a visible control and a keyboard shortcut both open settings; the user identifier and email address render as non-editable values; display name, language and password can each be changed; a language change takes effect immediately; a rejected password names the failed rule.
  - **Not in this task**: making the shortcut configurable, or a non-macOS variant beyond a sensible default — both are Open Questions in the spec.
  - **Depends on**: T026, T023.
  - **Notes from implementation**:
    - The paths above are corrected: issue #29 split the tenant surface into
      three route groups, so settings lives under `(signed-in)/`.
    - The identifier and the address are rendered as text in a `<dl>`, not as
      disabled inputs. A disabled input still reads as something you might have
      been allowed to change; FR-037 says these cannot be, so they are not
      fields at all.
    - The shortcut is ⌘ + , on macOS and Ctrl + , elsewhere, and it stands down
      while the user is typing in a field. The visible control is always there
      for anyone whose browser has already claimed the combination.
    - Changing the language calls the procedure on selection and then
      `router.refresh()`. FR-040 wants it immediate, and the language is chosen
      by Server Components, so they have to re-render.
    - `account.test.ts` asserts the exact input keys of all four procedures.
      None accepts a user id, which is how FR-041 holds: acting on somebody else
      is not a check that could be forgotten, it is a request that cannot be
      expressed.

---

## Phase 8: User Story 6 — Operator reviews tenants and users (P2)

**Goal**: the console's numbers and flags tell the truth.

**Independent test**: register a tenant with two users, sign in as one, and confirm the console reports two users and exactly one completed first login.

- [X] T028 [US6] Add integration tests asserting the console's summary semantics

  - **Purpose**: US6's value is that the reported state is correct, which is a test rather than a screen.
  - **Spec**: US6 · FR-013, FR-014, FR-020
  - **Touches**: `apps/web/src/server/api/routers/admin/tenants.test.ts`, `apps/web/src/server/api/routers/admin/users.test.ts`
  - **Done when**: tests prove the user count matches the users registered; the chat count is `0` on an empty database; a registered user reads as not having completed first login, and the same user reads as completed after the onboarding procedures run; a reissue does not flip the flag back.
  - **Not in this task**: new screens or procedures — US6 is served by what T016, T019 and T020 already built.
  - **Depends on**: T020, T022.
  - **Notes from implementation**:
    - The tests live in a new file, `admin/console-summary.test.ts`, rather than
      in the two the task named. They span four routers, and they deliberately
      do *not* use the fixtures that set the first-login markers directly —
      they register real users and drive them through the real onboarding
      procedures. US6's value is not that the console can render a number, it is
      that the number matches what happened.
    - Writing them found a real defect and a spec inconsistency; see T028a and
      T028b.

- [X] T028a Read first-login state from the row, not from the request snapshot

  - **Purpose**: `onboarding.replacePassword` decided whether the language step
    was done by reading `ctx.user`, which is a snapshot taken when the request's
    context was built.
  - **Spec**: FR-033
  - **Touches**: `apps/web/src/server/api/routers/onboarding.ts`, `apps/web/src/server/api/routers/account.ts`
  - **Done when**: both onboarding steps check the row they are about to update;
    the password policy's display name comes from that row too. The email
    address still comes from the snapshot, because it is immutable.
  - **Not in this task**: `protectedProcedure`'s first-login gate, which reads
    the snapshot correctly — it decides whether *this* request may proceed, and
    a user cannot finish first login midway through one.
  - **Depends on**: T022.
  - **Note**: not in the original breakdown. Two requests arriving together
    would both have seen the same stale snapshot and both passed the check. It
    happened to work in the browser because each HTTP request builds a fresh
    context, which is exactly why a test that reuses one found it.

- [X] T028b Correct User Story 6's acceptance scenarios

  - **Purpose**: the scenarios said a user reads as having completed first login
    once they confirm their language.
  - **Spec**: US6, FR-033
  - **Touches**: `specs/022-admin-console-onboarding/spec.md`
  - **Done when**: the scenarios distinguish the two states an operator can
    actually observe — language confirmed but password not yet replaced, and
    both steps done — and the correction is recorded under Clarifications.
  - **Depends on**: nothing.
  - **Note**: the clarification session amended User Story 4 when it added the
    password step, and left User Story 6 behind. Corrected here, in the issue
    whose tests exposed it.

- [X] T028c Remove a NUL byte from a committed source file

  - **Purpose**: `create-operator.test.ts` contained a NUL byte, so git treated
    it as binary and showed no diff for it in review.
  - **Spec**: none — a defect.
  - **Touches**: `apps/web/src/server/auth/cli/create-operator.test.ts`
  - **Done when**: the file is text again, the assertion that used the stray
    byte as a fallback is rewritten to fail loudly instead, and a scan of every
    source file in the repository finds no others.
  - **Depends on**: nothing.
  - **Note**: introduced in issue #26 and merged. Harmless at runtime — the
    fallback never fired — but the file has been undiffable ever since. Noticed
    because this commit's `git diff --stat` reported it as `Bin`.

- [X] T028d Stop two tests reaching into each other's rows

  - **Purpose**: the suite had two ways for one test file to corrupt another's
    state, both latent until this issue added enough parallel load to lose.
  - **Spec**: plan.md "Test strategy"
  - **Touches**: `apps/web/src/server/api/routers/auth.test.ts`, `apps/web/src/server/auth/cli/create-operator.test.ts`
  - **Done when**: `auth.test.ts` ages only the two throttle keys it owns rather
    than every row on the TENANT surface; `create-operator.test.ts` counts only
    the address it owns rather than every operator in the database; the full
    suite passes three times running.
  - **Depends on**: nothing.
  - **Note**: both are mine — the `updateMany` from issue #29, the global
    `count()` from issue #26. Test files share one database by design (see
    `fixtures.ts`), which works only if every assertion and every write is
    scoped to rows that test created.

---

## Phase 9: User Story 7 — The product identifies itself and its viewer (P3)

**Goal**: both surfaces carry the mark and say who is signed in.

**Independent test**: sign in to each surface and see both without navigating.

- [X] T029 [US7] Verify and finish the mark and account display on both surfaces

  - **Purpose**: close the gap between "the components exist" and "every screen shows them".
  - **Spec**: US7 · FR-009, FR-041, FR-044, FR-045
  - **Touches**: `apps/web/src/app/(tenant)/layout.tsx`, `apps/web/src/app/(operator)/admin/layout.tsx`, `apps/web/src/components/mark.test.tsx`
  - **Done when**: both layouts render `<Mark />` and the signed-in principal on every screen beneath them; the mark is legible at icon scale against the dark base tone; a component test asserts the mark's accessible name.
  - **Not in this task**: a favicon, an app icon, or any change to `docs/assets/banner.svg`.
  - **Depends on**: T017, T023.
  - **Notes from implementation**:
    - The first-login screen was showing neither. It renders to a signed-in user
      and has no shell above it — the two layouts covered everything except the
      one route that sits between them.
    - The coverage test walks the route tree rather than asserting per
      component. Every component was fine on its own; what was missing was a
      screen, which is only visible from the tree.
    - `<Mark />` measures 28×28 in both shells and stays legible against the
      dark ground, including at a 400px viewport.

- [X] T029a Give the tenant-side account display a requirement number

  - **Purpose**: "signed-in account information visible in both surfaces"
    appeared in Scope and in User Story 7, but only the operator half ever had a
    number (FR-009).
  - **Spec**: FR-044a (new) · US7
  - **Touches**: `specs/022-admin-console-onboarding/spec.md`, `apps/web/src/components/account-badge.tsx`, `apps/web/src/server/api/routers/auth.ts`
  - **Done when**: FR-044a states the tenant-side requirement and says the
    first-login screens are included; the correction is recorded under
    Clarifications; the two comments that cited FR-041 for it — which is the
    unrelated "cannot view another user's account" — cite FR-044a instead.
  - **Depends on**: nothing.
  - **Note**: not in the original breakdown. An unnumbered requirement is one
    nothing can be traced to, which is how the first-login screen went uncovered
    through four issues.

---

## Phase 10: Polish & cross-cutting

- [X] T030 [P] Rewrite `apps/web/e2e/home.spec.ts` for the authenticated root

  - **Purpose**: the existing spec asserts marketing copy at `/` that no longer lives there.
  - **Spec**: plan.md "Compatibility"
  - **Touches**: `apps/web/e2e/home.spec.ts`
  - **Done when**: the spec asserts that an unauthenticated visit to `/` lands on the sign-in screen; nothing asserts the old tagline.
  - **Not in this task**: the onboarding or console flows.
  - **Depends on**: T024.
  - **Note**: done in issue #29 rather than here. #29 is the change that moved
    the root page, so it is the change that broke this spec — leaving it red for
    a later issue would have meant merging a red `main`.

- [X] T030a Restore Prisma client generation in the E2E job

  - **Purpose**: unbreak CI.
  - **Spec**: research.md R9
  - **Touches**: `.github/workflows/ci.yml`
  - **Done when**: the E2E job runs `pnpm db:generate` before `pnpm db:deploy`.
  - **Depends on**: nothing.
  - **Note**: not in the original breakdown, and a defect of my own making.
    Issue #27 switched the E2E job from `db:push` to `db:deploy`. `db:push`
    generates the client as a side effect and `db:deploy` does not, so the
    client stopped being generated there. It stayed latent until #29 put a
    database-reading layout on the path for `/`, at which point the dev server
    could not start at all.

- [X] T031 [P] Add `apps/web/e2e/onboarding.spec.ts`

  - **Purpose**: prove SC-001, SC-002 and SC-006 end to end.
  - **Spec**: US1, US3, US4, US6 · quickstart.md sections 1, 4, 5, 6
  - **Touches**: `apps/web/e2e/onboarding.spec.ts`
  - **Done when**: the spec bootstraps or seeds an operator, registers a tenant and a user, completes first login with a new password, confirms the issued password no longer works, and confirms the console shows first login as complete.
  - **Not in this task**: throttling timing (too slow for E2E — it is covered by T009's unit tests).
  - **Depends on**: T025, T028.

- [X] T032 [P] Add `apps/web/e2e/operator-console.spec.ts`

  - **Purpose**: prove the console's registration paths including the refusals.
  - **Spec**: US2, US3 · quickstart.md sections 2, 3, 4
  - **Touches**: `apps/web/e2e/operator-console.spec.ts`
  - **Done when**: the spec covers the unauthenticated redirect, tenant registration with the Japanese default, the empty-name refusal, user registration with the tenant's default language pre-selected, and the duplicate-address refusal.
  - **Not in this task**: first login (that is T031).
  - **Depends on**: T020.

- [X] T033 Add the tenant-isolation and credential-exposure regression tests

  - **Purpose**: SC-007 and FR-003 are the two properties worth asserting rather than trusting.
  - **Spec**: SC-005, SC-007, FR-003, FR-038, FR-042
  - **Touches**: `apps/web/src/server/api/routers/account.test.ts`, `apps/web/src/server/api/routers/auth.test.ts`
  - **Done when**: a test calls procedures directly as a user of tenant A and proves no response carries tenant B's data; a test proves no read procedure on any router returns a password or a hash.
  - **Not in this task**: driving these through the UI — the point is to bypass it.
  - **Depends on**: T026, T021.

- [X] T034 Run the full gate and the quickstart

  - **Purpose**: the definition of done for the feature.
  - **Spec**: quickstart.md
  - **Touches**: nothing — this task fixes whatever it finds, in the file that owns it
  - **Done when**: `pnpm check` passes; `pnpm test:e2e` passes against a migrated database; every section of `quickstart.md` behaves as written.
  - **Not in this task**: opening the pull request.
  - **Depends on**: everything above.
  - **Notes from implementation**:
    - Every section of the quickstart was walked against a freshly reset
      database. Section 6 did not behave as written — see T034a.
    - The E2E specs bootstrap their operator through the CLI rather than seeding
      one, so US1 is exercised for real: if the command stops printing a usable
      password, these specs stop being able to sign in.
    - Each E2E test runs from its own `x-forwarded-for`, because the per-client
      throttle counts across the whole suite otherwise and a couple of
      deliberate wrong passwords lock the rest out. That is the protection
      working; distinct addresses are also the truthful model, since these are
      different people.

- [X] T034a Stop the operator console answering from a stale cache

  - **Purpose**: quickstart section 6 says "open the tenant" and expects to see
    a completed first login. It showed the previous answer.
  - **Spec**: FR-020, SC-006 · US6
  - **Touches**: `apps/web/src/lib/trpc-client.tsx`, `apps/web/src/app/(operator)/(signed-in)/admin/tenant-console.tsx`, `apps/web/src/app/(operator)/(signed-in)/admin/tenants/[tenantId]/tenant-detail.tsx`
  - **Done when**: the console's three reads refetch on mount instead of being
    served from the default 30-second cache; an E2E test asserts the flag flips
    after navigating back into the tenant, with no reload.
  - **Not in this task**: changing the global `staleTime`, which is right for
    the tenant application.
  - **Depends on**: T031.
  - **Note**: SC-006 promises "within one page refresh", and a refresh did work,
    so this was not a broken requirement — it was a requirement written loosely
    enough to permit a screen that answers "has this landed yet?" with a
    half-minute-old no. The console is a monitoring surface; it should not.

---

## Dependencies

**Phase order**: Setup → Foundational → US1 → US2 → US3 → US4 → US5 → US6 → US7 → Polish.

Foundational is a hard gate: nothing in any story phase compiles without T003,
T004, T011.

**Story dependencies** — these stories are *not* independent, and pretending
otherwise would produce tasks nobody can run:

- **US1** needs only Foundational.
- **US2** needs US1, because there is no way to sign in to the console otherwise.
- **US3** needs US2, because a user is registered inside a tenant.
- **US4** needs US3, because it signs in as the user US3 created.
- **US5** needs US4, because settings sit behind a completed first login.
- **US6** needs US3 and US4, because it asserts the state they produce.
- **US7** needs US2 and US4's layouts to exist.

This chain is inherent to onboarding: each story creates the thing the next one
consumes. The independence that matters here is *reviewability* — each phase is a
coherent increment that can be demonstrated on its own once its predecessors are
in place.

## Parallel opportunities

- **Setup**: T002 runs alongside T001.
- **Foundational**: T005, T006, T007, T012 and T013 are all independent of each
  other. T008 and T009 both wait on T004 but not on each other.
- **Within a story**: the router task and the screen task are sequential (the
  screen calls the procedures), but two screens in different route groups never
  collide.
- **Polish**: T030, T031 and T032 are three separate spec files and can be
  written in parallel once their flows exist.

## Implementation strategy

**MVP**: Setup + Foundational + US1 + US2 + US3 + US4. That is thirteen tasks and
it delivers the whole point of the feature — an operator can create a customer
and that customer's first person can sign in and reach the application. US5, US6
and US7 are worth having and none of them is load-bearing.

**Suggested execution order**: T001 → T002 → T003 → T004 → T005 → T006 → T007 →
T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 →
T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 →
T030 → T031 → T032 → T033 → T034.

**Checkpoints worth stopping at**: after T014 (an operator exists), after T018
(the console works), after T025 (the MVP is demonstrable), after T034 (ready for
the pull request).
