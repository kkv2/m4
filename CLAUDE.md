# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What M4 is

M4 is a **multi-tenant SaaS web application**: many companies share one platform
while staying isolated from each other. LLM chat is the core experience,
combined with RAG search over documents uploaded by the tenant.

Two product invariants drive most design decisions:

- **Tenant isolation.** Every row that carries conversation or knowledge belongs
  to exactly one tenant. Any query that reads such data must be scoped by
  `tenantId`. Never rely on a global filter to do this for you.
- **No private per-user space.** Uploaded files and derived knowledge are shared
  across the whole tenant, by design. A per-user space would let knowledge become
  siloed again, which is the problem M4 exists to solve.

## Workflow rules (non-negotiable)

### 1. Never commit to `main`

`main` is the integration branch. All development happens on a working branch
cut from an up-to-date `main`, and lands through a pull request **into `main`**.

```bash
git checkout main
git pull
git checkout -b <type>/<issue-number>-<short-description>
```

### 2. Branch naming

The pattern is `<type>/<issue-number>-<short-description>`, where the issue
number is the GitHub issue the work belongs to and the description is short,
lowercase and hyphenated.

| Type | Use for |
| --- | --- |
| `feature/` | New user-facing capability |
| `fix/` | Bug fix |
| `chore/` | Tooling, dependencies, configuration, housekeeping |
| `docs/` | Documentation only |
| `refactor/` | Restructuring with no behaviour change |
| `test/` | Tests only |

Examples: `feature/12-model-selector`, `chore/3-tech-stack-setup`,
`fix/27-tenant-scope-leak`.

### 3. Open an issue first

Work starts from a GitHub issue, because the branch name needs its number. If no
issue covers the task, create one before branching.

### 4. Every change lands via a PR into `main`

Open the PR with `gh pr create --base main`. Reference the issue in the body so
it closes on merge (`Closes #<number>`). Do not merge without CI passing.

### 5. Verify before you push

```bash
pnpm check   # format:check + lint + typecheck + test
```

## Repository layout

```
m4/
├── apps/
│   └── web/              Next.js (App Router) — UI and the tRPC BFF
│       ├── src/app/      Routes, layouts, and the tRPC HTTP handler
│       ├── src/server/   BFF: tRPC routers, context, LLM clients
│       ├── src/lib/      Client-side helpers (tRPC React provider)
│       ├── src/env/      Zod-validated environment contracts
│       └── e2e/          Playwright specs
├── packages/
│   ├── db/               Prisma schema, migrations, shared PrismaClient
│   └── config/           Shared ESLint flat config and tsconfig base
├── docker/               Local PostgreSQL (pgvector) via Docker Compose
└── .github/workflows/    CI
```

Workspace packages are referenced by name: `@m4/web`, `@m4/db`, `@m4/config`.

## Commands

Run everything from the repository root; pnpm dispatches to the right package.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install all workspace dependencies |
| `pnpm db:up` | Start local PostgreSQL in Docker |
| `pnpm db:down` | Stop it |
| `pnpm db:reset` | Destroy the volume and start clean |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | Create and apply a migration (prompts for its name) |
| `pnpm db:deploy` | Apply pending migrations without generating one |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm dev` | Run the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Vitest (unit and integration) |
| `pnpm test:e2e` | Playwright (E2E) |
| `pnpm check` | Everything CI runs, in one go |

First-time setup: `cp .env.example .env`, fill in the API keys, then
`pnpm install && pnpm db:up && pnpm db:push`.

There is **one `.env`, at the workspace root**, shared by every package. Prisma
finds it because its commands run from the root; `apps/web` loads it explicitly
in `src/env/server.ts`, since Next.js otherwise only looks inside `apps/web`.

## Tech stack

TypeScript everywhere. Next.js (App Router) with React and Tailwind CSS on the
front, tRPC as the BFF layer, Prisma against PostgreSQL, OpenAI and Gemini as
the LLM providers, Vitest and Playwright for tests, Docker Compose for local
infrastructure. Cloud infrastructure is deliberately out of scope for now.

## Conventions

- **TypeScript is strict**, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Do not add `any` or `@ts-expect-error` to get
  past a type error — fix the type.
- **Imports inside `apps/web` use the `~/` alias** for `src/`.
- **Server-only code stays under `src/server/`.** Anything importing
  `~/env/server` or a provider SDK must never reach a client component.
- **Environment variables go through `src/env/`.** Do not read `process.env`
  directly in application code, and add every new variable to `.env.example`
  and to the Zod schema in the same change.
- **Procedures that touch tenant data use `protectedProcedure`** and scope every
  query by `ctx.tenantId`.
- **Dark base tone.** The palette lives in `apps/web/src/app/globals.css` as
  Tailwind theme tokens. Use the tokens rather than hard-coded colours.
- **Prisma models are `PascalCase` singular** and map to `snake_case` plural
  tables via `@@map`.
- **Tests live next to the code** as `*.test.ts(x)`; E2E specs live in
  `apps/web/e2e` as `*.spec.ts`.

## Development method

The project follows **SDD (Spec Driven Development)** and **AI-DLC**, driven by
GitHub Spec Kit: a specification is agreed first, then implemented. Humans write
zero lines of code — the implementation is entirely AI-authored, so the spec, the
issue and the PR description carry the intent that code review would otherwise
have to reconstruct.

## Language

Code, comments, commit messages, documentation and PR descriptions are written
in **English**. GitHub issues may be written in Japanese.
