# Engineering guidelines

## Database migrations

1. Edit `src/server/db/schema.ts`
2. Run `pnpm db:generate` and review the SQL
3. Run `pnpm db:migrate` locally
4. Commit the SQL file and matching `drizzle/meta/*` snapshot together

Rules:

- Use `db:generate` + `db:migrate`, not `db:push` or raw SQL
- Every journal entry in `drizzle/meta/_journal.json` needs a matching `NNNN_snapshot.json`
- If `db:generate` re-emits old changes, the snapshot chain is broken — fix snapshots before generating again

Healthy state: `pnpm db:generate` reports no changes when `schema.ts` is up to date.

## UI patterns

Pages are thin. They render a `*-workspace` component that fetches data and composes `*-panel` sections.

| Suffix | Use for |
|--------|---------|
| `*-workspace` | Page-level data + state |
| `*-panel` | Section inside a workspace |
| `*-sheet` | Create, edit, upload |
| `*-dialog` | Delete confirmation or read-only preview |

- **Forms:** `useState` + `validate*()` + `toast`. Zod validation lives in tRPC routers.
- **Sheets** for forms/uploads. **AlertDialog** for deletes. Mount sheets with `key={entityId}` to reset state.
- **tRPC:** `~/trpc/react` in client components, `~/trpc/server` in RSC. Invalidate only affected queries after mutations.
- **Uploads:** REST via `lib/upload-*.ts`, then invalidate tRPC caches.
- **Styling:** shadcn primitives from `~/components/ui/*`, `shadow-none` on cards, `~/` imports.

Business logic goes in `src/lib/`. Components hold UI state only. Follow existing files in the same area before inventing new patterns — `accounts-workspace.tsx` and `account-detail-workspace.tsx` are good references.

## Tests

Unit tests for `src/lib/` and `src/server/` only. Use fictional data. No component tests unless asked.
