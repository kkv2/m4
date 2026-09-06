<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Ratification: initial adoption; every placeholder replaced with concrete M4 rules.
- Added principles:
  - I. Tenant Isolation (NON-NEGOTIABLE)
  - II. One Shared Tenant Space
  - III. Spec Before Code
  - IV. Types Are the Contract
  - V. Every Change Lands Through a Pull Request
- Added sections: Engineering Constraints; Development Workflow; Governance
- Removed sections: none
- Sources: CLAUDE.md, apps/web/AGENTS.md, README.md
- Follow-up TODOs: none
-->

# M4 Constitution

M4 is a multi-tenant SaaS web application. Many companies share one platform
while staying isolated from each other. LLM chat is the core experience,
combined with RAG search over documents the tenant uploads.

This document is the standing agreement the specifications are checked against.
It outranks convenience, habit and any individual specification.

## Core Principles

### I. Tenant Isolation (NON-NEGOTIABLE)

Every row that carries conversation or knowledge belongs to exactly one tenant.
Any query that reads such data is scoped by `tenantId` at the call site.
Procedures that touch tenant data use `protectedProcedure` and filter by
`ctx.tenantId`.

Never delegate this to a global filter, a middleware, or a convention that a
future reader has to trust. A leak here is not a bug the user reports — it is
one tenant reading another tenant's documents, and it is unrecoverable once it
has happened. The scope must be visible in the query that needs it.

### II. One Shared Tenant Space

Uploaded files and derived knowledge are shared across the whole tenant. There
is no private per-user space, by design.

M4 exists because knowledge gets siloed inside a company. A per-user space
recreates the silo one level down and quietly undoes the product. A feature that
needs "just my documents" is a feature that needs a different product.

### III. Spec Before Code

Work that carries a real design decision — a new capability, a schema change,
anything that sets a precedent — is specified before it is implemented, through
the Spec Kit flow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`).

Humans write zero lines of code here: the implementation is entirely AI-authored.
The specification, the issue and the pull request description carry the intent
that code review would otherwise have to reconstruct from the diff. A small or
self-evident change may simply be written. When in doubt, write the spec — its
cost is low next to the cost of a design nobody agreed to.

### IV. Types Are the Contract

TypeScript runs strict, including `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`. `any` and `@ts-expect-error` are not available as
a way past a type error; the type gets fixed instead.

Environment variables are read through `src/env/`, never `process.env` in
application code, and every new variable lands in `.env.example` and the Zod
schema in the same change. A type error is the cheapest place to find a defect,
and every escape hatch moves that discovery to production.

### V. Every Change Lands Through a Pull Request

`main` is the integration branch and is never committed to directly. Work starts
from a GitHub issue, continues on a branch named
`<type>/<issue-number>-<short-description>` cut from an up-to-date `main`, and
lands through a pull request into `main` that references the issue. `pnpm check`
passes before the push, and CI passes before the merge.

This is the only durable record of why the codebase looks the way it does. It is
not subject to the judgement call in Principle III: branch and pull request
discipline applies to every change, spec or not.

## Engineering Constraints

- **Stack.** TypeScript everywhere; Next.js (App Router) with React and Tailwind
  CSS; tRPC as the BFF layer; Prisma against PostgreSQL with pgvector; OpenAI and
  Gemini as the LLM providers; Vitest and Playwright for tests; Docker Compose
  for local infrastructure. Cloud infrastructure is deliberately out of scope.
- **Server boundary.** Server-only code stays under `apps/web/src/server/`.
  Anything importing `~/env/server` or a provider SDK must never reach a client
  component.
- **Imports.** Inside `apps/web`, `src/` is imported through the `~/` alias.
- **Data model.** Prisma models are `PascalCase` singular and map to
  `snake_case` plural tables via `@@map`. The client connects through the
  `@prisma/adapter-pg` driver adapter; `schema.prisma` carries no connection URL.
- **Visual language.** A dark base tone, expressed as Tailwind theme tokens in
  `apps/web/src/app/globals.css`. Use the tokens, not hard-coded colours.
- **Tests.** Unit and integration tests live next to the code as `*.test.ts(x)`;
  E2E specs live in `apps/web/e2e` as `*.spec.ts`.
- **Language.** Code, comments, commit messages, documentation, specifications
  and pull request descriptions are written in English. GitHub issues may be
  written in Japanese.

## Development Workflow

1. **Open an issue.** The branch name needs its number, so the issue comes first.
2. **Branch.** `git checkout main && git pull && git checkout -b <type>/<issue-number>-<short-description>`.
   Types: `feature/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`.
3. **Specify.** `/speckit-specify` writes `specs/<issue-number>-<short-name>/spec.md`.
   Pass the issue number so the specification, the issue and the branch share it.
   `/speckit-clarify` de-risks ambiguity before planning.
4. **Plan and break down.** `/speckit-plan`, then `/speckit-tasks`.
   `/speckit-analyze` cross-checks the artefacts before implementation.
5. **Implement.** `/speckit-implement`, or write the change directly when it is
   small enough to skip the specification under Principle III.
6. **Verify.** `pnpm check` (format, lint, typecheck, unit and integration tests)
   and, where the change touches the UI, `pnpm test:e2e`.
7. **Open the pull request.** `gh pr create --base main`, with `Closes #<number>`
   in the body. Merge only once CI is green.

The specification is part of the change and lands in the same pull request as
the code it describes.

## Governance

This constitution supersedes conflicting practice elsewhere in the repository.
Where a specification, a plan or a review comment disagrees with it, the
constitution wins and the other document is corrected.

**Amendments** are made through the same workflow as code: an issue, a branch, a
pull request. An amendment states what changed and why. `CLAUDE.md` and this
document describe the same rules from different angles — an amendment that
touches shared ground updates both in one change.

**Versioning** follows semantic versioning. MAJOR: a principle is removed or
redefined in a way that invalidates existing work. MINOR: a principle or section
is added, or its guidance materially expanded. PATCH: clarification and wording.

**Compliance.** Every pull request is checked against these principles. Principles
I and II are verified explicitly, because their violations are invisible in a
passing test suite. Complexity that a principle does not obviously permit is
justified in the pull request body or removed.

**Version**: 1.0.0 | **Ratified**: 2026-09-06 | **Last Amended**: 2026-09-06
