# packages/db

Owns the Prisma schema, migrations and the shared `PrismaClient`. See the root
`CLAUDE.md` for workflow rules.

## Schema conventions

- Models are `PascalCase` singular; tables are `snake_case` plural via `@@map`.
- Every tenant-owned model carries `tenantId` with a relation to `Tenant`,
  `onDelete: Cascade`, and an index that leads with `tenantId`.
- Timestamps are `createdAt DateTime @default(now())` and
  `updatedAt DateTime @updatedAt`.
- The generated client is written to `src/generated/client` and is **not**
  committed. `schema.prisma` and `migrations/` are.

## Changing the schema

Run these **from the workspace root** — that is the only directory where Prisma
finds the shared `.env`.

```bash
pnpm db:migrate     # creates and applies a migration, then regenerates the
                    # client; prompts for the migration name
pnpm db:generate    # regenerate the client on its own
```

`db:generate` is the exception that runs inside this package, because
generating needs no database connection and therefore no environment.

Never edit an applied migration. Use `pnpm db:push` only for throwaway local
experiments, never as a substitute for a migration on a change that ships.

## RAG

`DocumentChunk` holds retrievable text. The embedding column is added by a
follow-up migration once pgvector is wired up — the local Postgres image already
enables the extension (`docker/initdb/01-extensions.sql`).
