# Phase 1 Data Model: Operator Console, Tenant & User Onboarding, First Login

**Feature**: 022-admin-console-onboarding | **Date**: 2026-09-06

All models live in `packages/db/prisma/schema.prisma` and follow the repository's
existing conventions: `PascalCase` singular models mapped to `snake_case` plural
tables with `@@map`, `cuid()` identifiers, `createdAt` / `updatedAt` pairs.

`Attachment`, `Document` and `DocumentChunk` are untouched by this feature.
`Conversation` and `Message` are untouched except that the operator console
counts conversations (FR-013).

---

## New enum

```prisma
enum Language {
  JA
  EN
}
```

Exactly two values, per the spec's Assumptions. Used by `Tenant.defaultLanguage`
and `User.language`.

Two more enums support throttling:

```prisma
enum SignInSurface { OPERATOR  TENANT }
enum ThrottleScope { ACCOUNT   CLIENT }
```

---

## Changed: `Tenant`

| Field | Change | Why |
| --- | --- | --- |
| `slug` | **removed** (was `String @unique`) | Q1 settled that nothing routes by tenant, so no human-facing tenant key is needed. Registration collects only a display name and a default language (FR-010). |
| `name` | unchanged | The display name of FR-010. |
| `defaultLanguage` | **added** — `Language @default(JA)` | FR-010, FR-011. The database default is the same Japanese default the form pre-selects, so the two cannot drift. |

Validation: `name` is required and must be non-empty after trimming (US2
scenario 3). Display names are **not** unique — two customers may legitimately
share a name, and the tenant identifier is what distinguishes them (FR-012).

Derived, never stored: user count and conversation count for FR-013. Both are
aggregate queries scoped to one tenant, not counter columns, because a stale
counter is worse than a cheap `count()` at this scale.

---

## Changed: `User` (the tenant user)

| Field | Change | Why |
| --- | --- | --- |
| `email` | `@@unique([tenantId, email])` → **`@unique`** on the column | FR-019. Platform-wide uniqueness is what makes sign-in by address alone unambiguous. |
| `name` | `String?` → **`String`** | FR-015 makes the display name a required registration field. |
| `passwordHash` | **added** — `String` | R2. Never leaves the server; never returned by any procedure. |
| `language` | **added** — `Language` | FR-016. Set from the tenant default at registration, then owned by the user (FR-040). |
| `languageConfirmedAt` | **added** — `DateTime?` | FR-029. Records that the user passed the language step, which is not the same as the language having a value. |
| `mustChangePassword` | **added** — `Boolean @default(true)` | FR-031. True whenever the current password was generated rather than chosen. |
| `firstLoginCompletedAt` | **added** — `DateTime?` | FR-020, FR-029. A timestamp rather than a boolean: the operator console shows the state, and the time is free. |
| `role` | unchanged | Not exercised by this feature (spec Assumptions). Left at its `MEMBER` default. |
| `tenantId` | unchanged | Still the isolation key for every read. |

Indexes: keep `@@index([tenantId])`; the `@unique` on `email` provides the
sign-in lookup index.

### First-login state machine

`firstLoginCompletedAt` is not an independent flag — it is set exactly when both
sub-steps are done, which is what makes FR-033's resume behaviour work.

| `languageConfirmedAt` | `mustChangePassword` | State | Where the user lands |
| --- | --- | --- | --- |
| `null` | `true` | Freshly registered | Language step |
| set | `true` | Language chosen, password not replaced | Password replacement step |
| set | `false` | First login complete → `firstLoginCompletedAt` set | The application |
| set | `true` *after completion* | Not reachable | — see below |

An operator reissue (FR-024) sets a generated password but must **not**
re-trigger first login for a completed user (FR-035). It therefore leaves
`mustChangePassword` alone: `true` for a user who never finished, `false` for one
who did. The reissued password of a completed user is simply their password until
they change it in settings.

---

## New: `Operator`

```prisma
model Operator {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions OperatorSession[]

  @@map("operators")
}
```

No `tenantId`: an operator belongs to no tenant, which is what lets the type
system keep FR-008. No display name — the console shows the email address as the
signed-in identity (FR-009). Created only by the CLI of FR-001.

`Operator.email` and `User.email` are separate uniqueness namespaces, which is
FR-019a.

---

## New: `UserSession` and `OperatorSession`

Two tables rather than one polymorphic table, per R7.

```prisma
model UserSession {
  id             String   @id @default(cuid())
  /// SHA-256 of the opaque token held by the browser. The token itself is
  /// never stored, so a database dump cannot be replayed as a session.
  tokenHash      String   @unique
  userId         String
  createdAt      DateTime @default(now())
  lastUsedAt     DateTime @default(now())
  expiresAt      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("user_sessions")
}
```

`OperatorSession` is the same shape against `Operator`.

- `expiresAt` implements FR-023a's 30-day sliding expiry: each successful
  resolution moves `lastUsedAt` and `expiresAt` forward.
- FR-023b (sign out) deletes one row by `tokenHash`.
- FR-023c (password change or reissue) deletes every row for that user except the
  one making the request.
- `onDelete: Cascade` is harmless here: nothing deletes users (FR-046).

**Write amplification note**: sliding expiry means a write on every request. The
resolver only extends the session when more than an hour has passed since
`lastUsedAt`, which keeps the common case a pure read.

---

## New: `SignInThrottle`

```prisma
model SignInThrottle {
  id              String        @id @default(cuid())
  surface         SignInSurface
  scope           ThrottleScope
  /// The email address for ACCOUNT scope, the client address for CLIENT scope.
  key             String
  failureCount    Int           @default(0)
  windowStartedAt DateTime      @default(now())

  @@unique([surface, scope, key])
  @@index([windowStartedAt])
  @@map("sign_in_throttles")
}
```

FR-022a to FR-022e. One row per counted key, upserted on failure and deleted on
success (ACCOUNT scope) per FR-022c. A window older than 15 minutes is treated as
empty and reset in place, so no background sweep is needed (R5).

Storing the address as the ACCOUNT key rather than a `userId` is deliberate: the
counter must behave identically for an address that has no account, which is what
keeps FR-022e from leaking existence.

---

## Migration

One initial migration under `packages/db/prisma/migrations/`, generated with
`pnpm db:migrate` (R9). It creates every table in the schema — the existing ones
have only ever been applied with `db:push`, so there is no prior history to
extend. The workflow moves from `db:push` to `db:migrate` from this feature on.

Local databases are reset with `pnpm db:reset` before applying it. There is no
deployed database, so nothing is at risk.

---

## What no model stores

- **A recoverable password.** Only scrypt hashes (FR-023).
- **A generated password.** It exists in memory long enough to be returned once
  by the procedure that generated it, and nowhere else (FR-003).
- **A session token.** Only its SHA-256 hash.
- **A per-user private space.** Nothing here is scoped below the tenant, per
  Constitution II.
