# Engineering guidelines

## Repository layout

- **`shared/lib/`** — domain rules and pure helpers
- **`shared/server/`** — tRPC routers, database, files, health, data platform wiring
- **`shared/components/`** — React UI used by the Vite client (import via `~/…`)
- **`host/`**, **`client/`**, **`desktop/`** — runtime shells; keep them thin

Platform-wide code stays in the monorepo root `packages/` directory, not under Passbook.

## Database migrations

1. Edit `shared/server/db/schema.ts`
2. Run `pnpm db:generate` and review the SQL
3. Run `pnpm db:migrate` locally
4. Commit the SQL file and matching `drizzle/meta/*` snapshot together

Rules:

- Use `db:generate` + `db:migrate`, not `db:push` or raw SQL
- Every journal entry in `drizzle/meta/_journal.json` needs a matching `NNNN_snapshot.json`
- If `db:generate` re-emits old changes, the snapshot chain is broken — fix snapshots before generating again

Healthy state: `pnpm db:generate` reports no changes when `schema.ts` is up to date.

## UI patterns

Routes live in **`client/src/routes/`**. They compose `shared/components/*-workspace` and `*-panel` sections.

| Suffix        | Use for                                  |
| ------------- | ---------------------------------------- |
| `*-workspace` | Page-level data + state                  |
| `*-panel`     | Section inside a workspace               |
| `*-sheet`     | Create, edit, upload                     |
| `*-dialog`    | Delete confirmation or read-only preview |

- **Forms:** `useState` + `validate*()` + `toast`. Zod validation lives in tRPC routers.
- **Sheets** for forms/uploads. **AlertDialog** for deletes. Mount sheets with `key={entityId}` to reset state.
- **tRPC:** `client/src/trpc/react.tsx` in client routes; invalidate only affected queries after mutations.
- **Uploads:** REST via `lib/upload-*.ts`, then invalidate tRPC caches.
- **Styling:** shadcn primitives from `~/components/ui/*`, `shadow-none` on cards, `~/` imports.

Business logic goes in `shared/lib/`. Components hold UI state only. Follow existing files in the same area before inventing new patterns — `accounts-workspace.tsx` and `account-detail-workspace.tsx` are good references.

## Tests

Unit tests for `shared/lib/` and `shared/server/` only. Use fictional data. No component tests unless asked.
