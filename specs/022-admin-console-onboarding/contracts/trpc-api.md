# Phase 1 Contract: tRPC Procedures

**Feature**: 022-admin-console-onboarding | **Date**: 2026-09-06

The BFF is tRPC, so the contract is the router shape and its Zod input schemas.
Routers live in `apps/web/src/server/api/routers/` and are registered in
`root.ts` alongside the existing `health` router.

## Procedure builders

Defined in `apps/web/src/server/api/trpc.ts`. Three of the four are new.

| Builder | Requires | Provides on `ctx` | Enforces |
| --- | --- | --- | --- |
| `publicProcedure` | nothing | — | *(exists)* |
| `onboardingProcedure` | a valid tenant-user session | `session`, `tenantId`, `user` | authentication only |
| `protectedProcedure` | a valid tenant-user session **and** `firstLoginCompletedAt != null` | `session`, `tenantId`, `user` | FR-034 |
| `operatorProcedure` | a valid operator session | `operator` | FR-007, FR-008 |

`protectedProcedure` already exists and already yields `ctx.tenantId`; this
feature makes the session real and adds the first-login requirement. Its
tenant-scoping contract is unchanged: **every query still scopes by
`ctx.tenantId` at the call site** (Constitution I).

`operatorProcedure` deliberately yields **no** `tenantId`. An operator procedure
that reads tenant-owned data takes the tenant identifier as an explicit input, so
the cross-tenant read is visible in the query rather than implied by the session.

---

## `auth` — tenant sign-in *(new router, `routers/auth.ts`)*

| Procedure | Builder | Input | Output |
| --- | --- | --- | --- |
| `signIn` | `publicProcedure` | `{ email: string (email), password: string }` | `{ next: "language" \| "password" \| "app" }` |
| `signOut` | `onboardingProcedure` | — | `void` |
| `me` | `onboardingProcedure` | — | `{ id, email, displayName, language, tenantId, tenantName, firstLoginCompleted }` |

- `signIn` sets the `m4_session` cookie on success (FR-021) and returns where the
  caller must go, derived from the first-login state machine in the data model.
- Failure returns `UNAUTHORIZED` with one message for every cause — wrong
  password, unknown address, throttled — per FR-022 and FR-022e.
- `signIn` is subject to `SignInThrottle` on both scopes before the password is
  ever compared (FR-022a).
- `me` powers the signed-in account display of FR-041 and never returns
  `passwordHash`.

## `onboarding` — first login *(new router, `routers/onboarding.ts`)*

| Procedure | Builder | Input | Output |
| --- | --- | --- | --- |
| `confirmLanguage` | `onboardingProcedure` | `{ language: "JA" \| "EN" }` | `{ next: "password" }` |
| `replacePassword` | `onboardingProcedure` | `{ newPassword: string }` | `{ next: "app" }` |

- `confirmLanguage` writes `language` and `languageConfirmedAt` (FR-029).
- `replacePassword` applies FR-032a, rejects a password equal to the issued one
  (FR-032), clears `mustChangePassword`, sets `firstLoginCompletedAt`, and ends
  the user's other sessions (FR-023c).
- Both refuse if the step they cover is already done, so a replayed request
  cannot rewind the state machine.

## `account` — the settings screen *(new router, `routers/account.ts`)*

| Procedure | Builder | Input | Output |
| --- | --- | --- | --- |
| `get` | `protectedProcedure` | — | `{ id, email, displayName, language }` |
| `updateDisplayName` | `protectedProcedure` | `{ displayName: string (1..100, trimmed) }` | `void` |
| `updateLanguage` | `protectedProcedure` | `{ language: "JA" \| "EN" }` | `void` |
| `changePassword` | `protectedProcedure` | `{ currentPassword: string, newPassword: string }` | `void` |

- `get` returns the read-only identifier and address of FR-037 and nothing that
  identifies another user (FR-041).
- Every procedure acts on `ctx.session.userId` only. None takes a user id as
  input, which is how FR-041 is enforced structurally rather than by a check.
- `changePassword` requires the current password, applies FR-032a, and ends the
  user's other sessions (FR-023c).

## `operatorAuth` — operator sign-in *(new router, `routers/operator-auth.ts`)*

| Procedure | Builder | Input | Output |
| --- | --- | --- | --- |
| `signIn` | `publicProcedure` | `{ email: string (email), password: string }` | `void` |
| `signOut` | `operatorProcedure` | — | `void` |
| `me` | `operatorProcedure` | — | `{ id, email }` |

Sets and clears `m4_operator_session`. Throttled on the `OPERATOR` surface, so
operator and tenant counters never share a key. There is no `create` procedure,
per FR-004.

## `admin.tenants` *(new router, `routers/admin/tenants.ts`)*

| Procedure | Builder | Input | Output |
| --- | --- | --- | --- |
| `list` | `operatorProcedure` | — | `{ id, name, defaultLanguage, userCount, conversationCount, createdAt }[]` |
| `create` | `operatorProcedure` | `{ name: string (1..200, trimmed), defaultLanguage: "JA" \| "EN" }` | `{ id }` |
| `get` | `operatorProcedure` | `{ tenantId: string (cuid) }` | as `list`, one row |
| `update` | `operatorProcedure` | `{ tenantId: cuid, name: string (1..200, trimmed), defaultLanguage: "JA" \| "EN" }` | as `list`, one row |

`userCount` and `conversationCount` are FR-013; both are aggregates, and
`conversationCount` is structurally zero until issue #23 lands (FR-014).

`update` takes exactly the fields `create` takes. The identifier is what tells
two same-named customers apart, so nothing can change it, and there is no delete
counterpart (FR-046).

## `admin.users` *(new router, `routers/admin/users.ts`)*

| Procedure | Builder | Input | Output |
| --- | --- | --- | --- |
| `listByTenant` | `operatorProcedure` | `{ tenantId: string (cuid) }` | `{ id, email, displayName, language, firstLoginCompletedAt }[]` |
| `create` | `operatorProcedure` | `{ tenantId: cuid, email: email, displayName: string (1..100), language: "JA" \| "EN" }` | `{ id, generatedPassword: string }` |
| `update` | `operatorProcedure` | `{ userId: cuid, displayName: string (1..100), language: "JA" \| "EN" }` | as `listByTenant`, one row |
| `reissuePassword` | `operatorProcedure` | `{ userId: string (cuid) }` | `{ generatedPassword: string }` |

- `create` rejects an address already registered anywhere on the platform, with a
  message that does not name the holding tenant (FR-019, and the edge case that
  covers it).
- `generatedPassword` is the **only** place a password crosses the wire, and only
  in the response to the call that generated it (FR-003). It is never persisted
  in plaintext, never logged, and never returned by any read procedure.
- `update` changes the display name and the language, and nothing else. FR-018
  moves from "there is no such procedure" to "the input schema cannot carry an
  address": an `email` smuggled into the request is stripped before the procedure
  sees it. There is no `tenantId` either — moving a user between tenants would
  carry their history across an isolation boundary.
- `update` is not a credential change, so it leaves the password, both
  first-login markers and the user's sessions alone.
- `reissuePassword` ends the user's sessions (FR-023c) and leaves
  `firstLoginCompletedAt` untouched (FR-035).
- No procedure here has a delete counterpart (FR-046).

---

## Cookies

| Name | Set by | Attributes |
| --- | --- | --- |
| `m4_session` | `auth.signIn` | `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` outside development, `Max-Age` 30 days |
| `m4_operator_session` | `operatorAuth.signIn` | same, also `Path=/` — see below |
| `m4_signin_language` | the tenant sign-in screen | **not** `httpOnly` (the client toggles it), `SameSite=Lax`, one year |

The first two carry opaque tokens (R1). Both are scoped to `Path=/`, not to
their surface: the BFF lives at `/api/trpc`, so a cookie scoped to `/admin`
would never reach the procedures the console calls. The operator/tenant boundary
is held by the separate cookie names and separate session tables (R7), which is
where it belongs — path scoping would have been decoration that happened to
break the application. (Corrected during implementation of issue #27, after the
console signed in successfully and then got `UNAUTHORIZED` from every procedure.)

The third carries `ja` or `en` and is the device-level preference of FR-043b — it is a display preference, never a
credential, and FR-043d requires the account language to win once signed in.

`createTRPCContext` gains a `resHeaders` field so procedures can emit
`Set-Cookie`; `fetchRequestHandler` already supplies it.

---

## CLI contract

```
pnpm operator:create -- <email>
```

Creates one operator (FR-001), prints the generated password once (FR-002,
FR-003), exits non-zero with a clear message if the address already has an
operator account (FR-005). No other command is added.
