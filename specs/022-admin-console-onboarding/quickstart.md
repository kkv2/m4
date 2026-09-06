# Phase 1 Quickstart: Validating Operator Console & First Login

**Feature**: 022-admin-console-onboarding | **Date**: 2026-09-06

How to prove the feature works end to end, by hand. This walks SC-001 and SC-002
in order and touches every P1 user story. Automated coverage is in the plan's
test strategy; this is the run guide.

## Prerequisites

```bash
pnpm install
pnpm db:up          # local PostgreSQL in Docker
pnpm db:reset       # destroys the volume — this feature introduces the first migration
pnpm db:up
pnpm db:deploy      # apply the initial migration
```

`.env` must exist at the workspace root (`cp .env.example .env`). This feature
adds **no new environment variables**, so an existing `.env` needs no edit.

## 1. Bootstrap the first operator (US1)

```bash
pnpm operator:create -- ops@example.com
```

Expected: a generated password printed exactly once. Copy it — there is no way to
read it back (FR-003). Running the same command again must fail without creating
a second account (US1 scenario 2).

## 2. Sign in to the operator console (US2)

```bash
pnpm dev
```

Open `http://localhost:3000/admin`. Expected: redirected to the operator sign-in
screen, entirely in Japanese, with no language switch (FR-006). Sign in with the
credentials from step 1. Expected: the tenant list, the M4 mark, and the
signed-in operator's address visible (FR-009, FR-044).

Check `http://localhost:3000/admin` in a private window first: it must redirect to
sign-in and show no tenant data (FR-007).

## 3. Register a tenant (US2)

Register one with a display name and the default language left at Japanese
(FR-011). Expected: the tenant appears with its identifier, 0 users and 0 chats
(FR-013, FR-014). Submitting an empty display name must be refused with a
validation message (US2 scenario 3).

Register a second tenant with English as its default language — step 5 needs it.

## 4. Register a tenant user (US3)

Inside the Japanese tenant, register a user. Expected: the language field is
pre-selected as Japanese (US3 scenario 1); on submit, a generated password is
displayed once (FR-017). Copy it.

Open the registration form under the English tenant. Expected: the language field
is pre-selected as English (US3 scenario 2).

Try registering the first user's address again, under **either** tenant.
Expected: refused, with a message that does not name the holding tenant
(FR-019).

## 5. Complete first login (US4)

Open `http://localhost:3000/` in a private window. Expected: the tenant sign-in
screen in Japanese, with a control to switch to English (FR-043a). Switch it,
reload, and confirm it stays English (FR-043b).

Sign in as the user from step 4. Expected, in order:

1. the language step, with the operator-set language pre-selected (FR-028);
2. after confirming, the password replacement step (FR-031);
3. after a valid password, the application (FR-033).

Try each of these at the password step and confirm the message names the rule
that failed (FR-032b):

| Input | Expected |
| --- | --- |
| the password the operator issued | rejected: must differ |
| `short` | rejected: at least 12 characters |
| `password1234` | rejected: too common |
| the user's own email address | rejected: cannot match your address |

Sign out and back in with the **new** password. Expected: straight to the
application, no first-login steps (FR-030). The **issued** password must no
longer work (SC-009).

## 6. Confirm the operator sees it (US6)

Back in the console, open the tenant. Expected: 1 user, and that user shown as
having completed first login (FR-020, SC-006). A user registered but never signed
in must show as not completed.

## 7. Settings (US5)

As the tenant user, open settings with the settings control and again with the
keyboard shortcut (FR-036). Expected: user identifier and email address shown and
not editable (FR-037). Change the display name, then the language — the interface
must switch language immediately (FR-040). Change the password, then confirm the
old one no longer signs in.

## 8. Sessions and throttling

- **Other sessions end on password change (FR-023c)**: sign in from two browsers,
  change the password in one, and confirm the other returns to sign-in on its
  next action. The browser that made the change stays signed in.
- **Reissue ends sessions (SC-011)**: with the user signed in, reissue their
  password from the console. The user's window must return to sign-in.
- **Throttling (FR-022c)**: fail sign-in five times for one address. The sixth
  attempt must be refused even with the correct password, and must succeed again
  after the cooling-off period. The refusal must look identical for an address
  with no account (FR-022e).

## 9. Tenant isolation (SC-007)

Register a user under the second tenant and sign in as them. No screen may show
anything belonging to the first tenant. This is also covered by an automated
test — the manual pass is a sanity check, not the guarantee.

## Automated checks

```bash
pnpm check      # format:check + lint + typecheck + test
pnpm test:e2e   # Playwright, needs the dev server and a migrated database
```
