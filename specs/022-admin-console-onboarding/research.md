# Phase 0 Research: Operator Console, Tenant & User Onboarding, First Login

**Feature**: 022-admin-console-onboarding | **Date**: 2026-09-06

The spec is technology-agnostic and its five clarifications settled the product
questions. What remains are the technical choices this feature forces on a
codebase that currently has no authentication at all. Each decision below is
recorded with what it costs, so the next feature does not have to re-derive it.

---

## R1. Session strategy — hand-rolled, database-backed, opaque tokens

**Decision**: Sessions are rows in PostgreSQL keyed by an opaque random token.
The browser holds the token in an `httpOnly`, `SameSite=Lax` cookie; the database
stores only its SHA-256 hash. No authentication library.

**Rationale**: The spec asks for four things that a general-purpose auth library
makes harder rather than easier:

- **Two disjoint principal types.** An operator is not a tenant user, and FR-008
  requires that neither can sign in to the other's surface. Auth.js models a
  single `User` with an adapter; representing two kinds means either a
  discriminator on one table (which FR-008 then has to defend at every call
  site) or two Auth.js instances in one app.
- **A blocking first-login flow.** FR-031 to FR-034 require that a signed-in but
  unfinished user reaches no application screen. This is a third authorisation
  state between "anonymous" and "authenticated", which is exactly what session
  callbacks are awkward at.
- **Server-side session revocation.** FR-023c ends every *other* session when a
  password changes. That is impossible with stateless JWT sessions and is the
  main reason to keep sessions in the database.
- **No providers.** There is no OAuth, no email link, no MFA. The entire benefit
  of an auth library — the provider ecosystem — is out of scope.

What we write instead is small: create a token, hash it, store a row, read it
back, delete rows. Roughly 150 lines under `src/server/auth/`.

**Alternatives considered**:

| Alternative | Rejected because |
| --- | --- |
| Auth.js (NextAuth v5) | Adapter models one user table; two principals and a blocking onboarding state fight the abstraction. Its value is providers we do not use. |
| Lucia | The library was deprecated by its author in 2025 in favour of exactly this pattern — copy the ~150 lines into your project. We take the advice directly. |
| Stateless JWT sessions | FR-023c cannot be satisfied. Revocation needs server state, at which point the JWT buys nothing. |

**Cost accepted**: we own the cookie flags, the token entropy, and the expiry
sweep. All three are covered by tests listed in the plan.

---

## R2. Password hashing — `scrypt` from `node:crypto`

**Decision**: `node:crypto.scrypt` with N=2^17, r=8, p=1, a 16-byte random salt
per password, and a 64-byte derived key. Stored as a single self-describing
string carrying the parameters, so they can be raised later without a migration.
Verification uses `timingSafeEqual`.

**Rationale**: OWASP's Password Storage guidance lists Argon2id first and scrypt
second as acceptable. scrypt is in the Node standard library, which means zero
new dependencies — worth a lot in a repository whose dependency list is
deliberately short and which has no production deployment to tune for. The
self-describing encoding means moving to Argon2id later is a rehash-on-next-login
change, not a schema change.

**Alternatives considered**:

| Alternative | Rejected because |
| --- | --- |
| Argon2id via `@node-rs/argon2` | Better algorithm, but a native dependency with prebuilt binaries per platform, for a local-only feature. Recorded as the upgrade path. |
| bcrypt | Third on OWASP's list, caps the password at 72 bytes, and is a native dependency too. No reason to prefer it over scrypt here. |
| Plain PBKDF2 | Also in `node:crypto`, but memory-hard scrypt is strictly better against GPU attack at the same effort. |

---

## R3. Common-password dictionary — a bundled static list

**Decision**: Ship a newline-delimited list of roughly 10,000 common passwords as
a data file under `apps/web/src/server/auth/`, loaded once into a `Set` on first
use. FR-032a's dictionary check is a `Set.has` on the lowercased candidate.

**Rationale**: The spec's assumption is explicit that this is a static shipped
list and that the feature makes no outbound requests, which rules out breach-API
lookups. 10,000 entries is a few hundred kilobytes, loads in single-digit
milliseconds, and catches the passwords that actually get chosen. The list must
carry its source and licence in a header comment.

**Alternatives considered**: `zxcvbn-ts` (a strength *estimator*, not a
deny-list — its score is harder to explain in the error message FR-032b requires,
and it is a large dependency); an online breach API (excluded by the spec).

---

## R4. Internationalisation — typed message dictionaries, no i18n library

**Decision**: Two message modules under `apps/web/src/i18n/messages/`, `ja.ts`
and `en.ts`. `ja.ts` is the source of truth for the message key type; `en.ts` is
typed against it, so a missing translation is a compile error. A small
`getMessages(language)` on the server and a `LanguageProvider` context on the
client. The operator console imports the Japanese messages directly and takes no
language from context.

**Rationale**: The language comes from the database — the signed-in user's
account (FR-043) — not from the URL. Every routing-based i18n library, `next-intl`
included, is built around a locale path segment, which this feature explicitly
does not have (Q1 settled that nothing routes by tenant or locale). Two
languages and a handful of screens do not need a message compiler, and typing
`en.ts` against `ja.ts` gives the one guarantee that matters: no missing key.

**Alternatives considered**: `next-intl` (its routing model is the wrong shape
here, and its non-routing mode is a thin wrapper over what we would write
anyway); `react-intl` (ICU message syntax is more than two-language UI copy
needs).

**Note for FR-043b**: the device-level choice on the tenant sign-in screen is a
cookie, not account state, and is read by the sign-in page's server component.

---

## R5. Throttling store — a database table, not memory

**Decision**: One `SignInThrottle` row per (surface, scope, key) — for example
`(TENANT, ACCOUNT, "a@example.com")` and `(TENANT, CLIENT, "203.0.113.7")` —
holding a window start and a failure count. Counted and cleared inside the
sign-in transaction.

**Rationale**: FR-022a counts failures per account *and* per client. An in-memory
map is a line of code but resets on every dev-server reload, cannot be asserted
on from an integration test that runs in a different process, and is wrong the
moment there is more than one process. A table is testable, survives a restart,
and needs no new infrastructure — which matters because this feature adds none.

**Cost accepted**: rows accumulate. Expired windows are deleted opportunistically
when the same key is next touched; there is no background job. At this scale that
is enough, and it is written down here so nobody later mistakes it for an
oversight.

**Client identity**: taken from `x-forwarded-for` when present, else the
connection address. Locally this is usually `::1`, which is correct — it is one
client.

---

## R6. Operator bootstrap CLI — a `tsx` script behind a pnpm alias

**Decision**: `apps/web/src/server/auth/cli/create-operator.ts`, run as
`pnpm operator:create -- <email>` from the repository root, which dispatches to
`@m4/web`. Add `tsx` as a dev dependency.

**Rationale**: FR-004 requires that no network-facing path can create an
operator, so this cannot be a route. The script has to hash a password, which
means it must share `src/server/auth/password.ts` with the application — putting
it anywhere else would duplicate the hashing parameters, which is exactly the
kind of drift that produces an account nobody can sign in to. Keeping it under
`src/server/` also honours the repository rule that server-only code lives there.

`.nvmrc` pins Node 22.14, where TypeScript type stripping is still behind a flag
(it became the default in 22.18), so the repository cannot run a `.ts` file
directly today. `tsx` is the smallest way to close that gap and is a dev
dependency only.

**Alternatives considered**: a Prisma seed script (seeds are for fixtures, and
`prisma db seed` runs on reset — an operator account must be created
deliberately); compiling the script with `tsc` first (adds a build step to a
one-shot command).

---

## R7. Two principals in the tRPC context — separate cookies, separate builders

**Decision**: Two cookie names (`m4_session` for tenant users, `m4_operator_session`
for operators), two session tables, and two procedure builders. The context
resolves at most one of each and exposes them as distinct fields.

**Rationale**: FR-008 is a security boundary, and the cheapest way to enforce a
boundary is to make crossing it unrepresentable. With separate cookies, an
operator's browser simply does not carry a credential the tenant application
would look at. With separate procedure builders, `operatorProcedure` never
produces a `tenantId` and `protectedProcedure` never produces an operator — so no
handler can confuse them, and the type checker says so.

A third builder, `onboardingProcedure`, authenticates a tenant user without
requiring that first login is complete. `protectedProcedure` gains that
requirement, which is what makes FR-034 hold for every application procedure
without each one remembering to check.

**Alternatives considered**: one polymorphic session table with two nullable
foreign keys (every read then has to prove which kind it got, forever); one
cookie carrying a role claim (a bug in one comparison crosses the boundary).

---

## R8. Route protection — route-group layouts, not middleware

**Decision**: Authentication and first-login redirects happen in server
components at the top of each route group's layout. No `middleware.ts`.

**Rationale**: Next.js middleware runs on the Edge runtime, where Prisma and
`node:crypto`'s scrypt are unavailable. Resolving a database-backed session is
precisely what middleware cannot do here. Layout-level checks run on the Node
runtime, are ordinary server code, and sit next to the screens they protect.

**Cost accepted**: the check runs per route-group render rather than once at the
edge. At this scale it is one indexed lookup.

---

## R9. Prisma migrations — this feature creates the first one

**Decision**: Generate an initial migration that reflects the schema *as it will
be after this feature*, and switch the workflow from `pnpm db:push` to
`pnpm db:migrate`.

**Rationale**: `packages/db/prisma/migrations/` does not exist — the schema has
only ever been applied with `db:push`. Since there is no deployed database and no
production (both explicitly out of scope), there is nothing to preserve: one
clean initial migration is honest and leaves the repository in the state
`db:deploy` in CI already assumes. Trying to fabricate a baseline plus a delta
would record a history that never happened.

---

## R10. The product mark — a cropped SVG derived from the banner

**Decision**: Add `apps/web/public/mark.svg`, a square crop of the "M4" wordmark
from `docs/assets/banner.svg`, plus a `<Mark />` component that renders it at a
given size with the accessible name "M4".

**Rationale**: FR-044 asks for the README hero banner or a crop of it, at icon
scale. The banner is already an SVG with the wordmark drawn on a dark ground, so
the crop is a viewBox change and reuse of the same gradients — no raster asset,
no new dependency, and FR-045's legibility against the dark base tone comes for
free because the mark was designed on that ground.

---

## Resolved

No `NEEDS CLARIFICATION` items remain. Every technical unknown named in the
spec's Assumptions has a decision above, and every decision names what it costs.
