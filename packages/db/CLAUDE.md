# packages/db

Owns the Prisma schema, migrations and the shared `PrismaClient`. See the root
`CLAUDE.md` for workflow rules.

## How Prisma is wired (v7)

Prisma 7 split configuration in two, and both halves live outside this file:

- **The CLI** reads `prisma.config.ts` at the workspace root. It declares the
  schema path, the migrations path and the datasource URL, so none of the
  `db:*` scripts pass `--schema` any more. `schema.prisma` itself has a
  `datasource` block with only a `provider` — a `url` there is now an error.
- **The runtime** connects through a driver adapter. `src/index.ts` builds
  `@prisma/adapter-pg` from `DATABASE_URL` and hands it to `PrismaClient`.

The client is produced by the `prisma-client` generator (the old
`prisma-client-js` is deprecated), which emits TypeScript rather than JavaScript
into `src/generated/client`. Import it from `client.ts` — with the extension,
which `importFileExtension` in the generator block makes consistent throughout.

## Schema conventions

- Models are `PascalCase` singular; tables are `snake_case` plural via `@@map`.
- Every tenant-owned model carries `tenantId` with a relation to `Tenant`,
  `onDelete: Cascade`, and an index that leads with `tenantId`.
- Timestamps are `createdAt DateTime @default(now())` and
  `updatedAt DateTime @updatedAt`.
- The generated client is written to `src/generated/client` and is **not**
  committed. `schema.prisma` and `migrations/` are.

## Changing the schema

Run these **from the workspace root**, where `prisma.config.ts` sits.

```bash
pnpm db:migrate     # creates and applies a migration, then regenerates the
                    # client; prompts for the migration name
pnpm db:generate    # regenerate the client on its own
```

Prisma 7 no longer regenerates the client as a side effect of `migrate` or
`db push`, so both scripts chain `db:generate` explicitly.

Formatting the schema is the one command that runs inside this package
(`pnpm --filter @m4/db format`); it points the CLI back at the root config.

Never edit an applied migration. Use `pnpm db:push` only for throwaway local
experiments, never as a substitute for a migration on a change that ships.

## RAG

`DocumentChunk` holds retrievable text. The embedding column is added by a
follow-up migration once pgvector is wired up — the local Postgres image already
enables the extension (`docker/initdb/01-extensions.sql`).
