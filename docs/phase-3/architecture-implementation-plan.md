# Phase 3 architecture decisions — implementation handoff

Planning snapshot: 2026-09-28. The [Phase 3 audit](./architecture-audit.md)
records the accepted architecture and evidence. This document translates its
vertical-slice decision into concrete, reviewable refactors against the current
tree. It is an implementation handoff, not a change to the [roadmap's phase
ownership](../../ROADMAP.md#5-phase-ownership): Phase 3 owns the inventory and
decisions; Phase 6 owns app-level convergence. Phase 4 owns data durability,
Phase 5 owns shared UI, and Phase 7 owns deployment alignment.

## What exists and what needs to move

All four apps still use `src/app`, `src/components`, `src/lib`, and
`src/server/api/routers`. Taxbook also uses `src/domain` and
`src/server/api/*-values.ts`. None has `src/modules` or `src/core` yet. Current
packages under `packages/data`, `packages/ui`, and `packages/data-ui` are real
Phase 4/5 foundations; the older audit's empty-packages description is no
longer the implementation baseline.

| App       | Current seam                                                                                                                   | First bounded refactor to consider                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Taxbook   | Pure rules in `src/domain`, persistence and some tRPC errors in `src/server/api/*-values.ts`, feature UI in `src/components/*` | Take one operation from `record-values.ts` (or the next actively changed value module). Separate its query, application sequencing, and transport error mapping; move only the domain rules it actually uses. |
| First Aid | Feature UI in `src/components/*`, rules in `src/lib`, queries in `src/server/api/routers/*`                                    | When a care-planning or visit operation changes, put its rule and query behind an application operation; keep the existing workspace UI intact until its orchestration needs splitting.                       |
| Passbook  | Period/document rules in `src/lib`, feature UI in `src/components/*`, account/document queries in routers                      | Use one account or statement operation with an existing test path. Preserve period derivation and document behavior while isolating one repository.                                                           |
| Tenure    | Pay and employment helpers in `src/lib`, feature UI in `src/components/*`, substantial query and write logic in `paychecks.ts` | Extract one paycheck read and one write, including their transaction and document linkage if applicable. Do not move the whole router or form in one change.                                                  |

These are candidate seams, not four mandatory migrations. Choose the pilot from
an active change or a focused boundary problem. The
[Phase 6 plan](../phase-6/technical-foundations.md) already calls for one pilot
and a second distinct app, then wider adoption only when it earns its cost.

## Target layout and ownership

The target is a layout for **migrated features**, not a command to move every
existing file. A small feature may keep several responsibilities in a few
colocated files until distinct boundaries are useful.

```text
apps/<app>/src/
  app/                              Next.js pages, layouts, HTTP routes
  server/api/routers/               tRPC transport adapters and router wiring
  trpc/                             tRPC client/server setup
  core/infrastructure/              app-wide DB client, storage adapters, logging
  modules/<feature>/
    domain/                         pure rules, types, validation
    application/                    use cases, commands, read DTOs
    infrastructure/                 concrete repository and external adapters
    presentation/                   feature UI and client orchestration
  components/ui/                    app-local low-level UI where still needed
```

`src/server/db/schema*` and the migration history can remain in their current
app-owned paths during the pilot. Moving them provides no boundary benefit and
would create large import churn. A repository may import that schema; domain,
application, and presentation code may not. Keep the existing `~/` alias and
public URLs stable. Routes and tRPC routers remain in their framework-owned
locations and call application operations. App-wide infrastructure can move to
`core/infrastructure` when its ownership becomes clearer; it must stay
app-local. `packages/data` remains the shared durability foundation, not an
app's domain database.

For one migrated operation, the dependency flow is:

```text
page / HTTP route / tRPC router → application operation → domain rule
                                              ↓
                                      concrete repository → app DB/schema
```

The operation owns scope checks, sequencing, and transaction boundaries. Its
repository is the only feature code that runs feature SQL. Read methods select
an explicit allow-list into domain objects or read DTOs; write methods accept
explicit commands. Never return an unrestricted row to a route or spread an
incoming request into an insert/update. Keep cross-app Taxbook–Tenure calls as
HTTP adapters, with no shared domain model. Use one concrete repository until
a real second implementation requires an interface.

## Reviewable implementation sequence (Phase 6)

1. **Establish the baseline.** Pick a read and a write in one feature; record
   current route/procedure names, payloads, response fields, error codes, and
   transaction behavior. Locate the relevant unit, integration, and E2E tests.
   Use fictional disposable data. Capture the current dependency direction
   before moving files.
2. **Extract pure rules first.** Move only rules used by the chosen operation
   from `src/lib`, Taxbook `src/domain`, or a router into
   `modules/<feature>/domain`. Remove framework, schema, and storage imports
   from those rules. Keep other `src/lib` files where they are until touched.
3. **Introduce one concrete repository.** Move the chosen read and write SQL
   from the router or `*-values.ts` into
   `modules/<feature>/infrastructure/<feature>-repository.ts`. Preserve joins,
   ordering, constraints, and the existing transaction. Select DTO fields
   explicitly and test that private/internal columns cannot leak.
4. **Add an application operation.** Put the workflow in
   `modules/<feature>/application`: scope checks, domain calls, repository
   sequencing, and transaction coordination. Keep transport-neutral errors
   here. Do not add a generic service layer, base repository, or DI container.
5. **Thin the transport adapter.** The existing tRPC router or HTTP route
   validates/parses transport input, calls the operation, and maps its result
   and errors. Preserve public names, shapes, Zod field errors, and safe
   messages. Taxbook's value modules should stop throwing `TRPCError` as their
   operations migrate. Leave untouched procedures in place.
6. **Move presentation only when useful.** Feature UI can move from
   `src/components/<feature>` to
   `modules/<feature>/presentation` as it receives substantial changes. A
   mechanical UI move should be a separate small PR; it is not a prerequisite
   for server boundaries. Shared low-level UI stays in `packages/ui` or local
   `components/ui` according to Phase 5 decisions.
7. **Validate in a second app.** Repeat the smallest useful read/write slice
   in a different domain. Record where the convention fits and where app
   behavior remains local. Only then consider sharing stable error or logging
   primitives, following the [Phase 6 plan](../phase-6/technical-foundations.md).

Each numbered step may be its own PR when review would otherwise be difficult;
steps 2–5 can be one PR for a small operation. Avoid a single PR that renames
all feature folders, changes public contracts, and alters schema at once.

## Adjacent refactors and phase boundaries

| Refactor                               | When and how                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TS/ESLint preset adoption              | Phase 6: compare effective configs, migrate one app, then the others with narrow overrides. Keep it separate from a feature slice.                                                                  |
| Transport-neutral errors               | Phase 6: start with the pilot operation and map to its actual HTTP/tRPC adapters; share only after two apps need the same semantics.                                                                |
| Structured server logging              | Phase 6: pilot safe event fields at one boundary and account for logs already emitted by `packages/data`; do not log record contents or duplicate a failure.                                        |
| Database constraints and migrations    | Keep schemas and migration history per app. Change constraints only for a real invariant, through the app's migration workflow. Phase 4 owns migration safety; Phase 6 owns repository conventions. |
| Storage, backup, and restore           | Continue using the Phase 4 `packages/data` contract. Do not fold a document migration into a folder reorganization.                                                                                 |
| UI primitives and interaction patterns | Phase 5 owns shared presentation and accessibility. Moving a feature's UI into `presentation` does not authorize extracting its domain state.                                                       |
| Docker, network, and release setup     | Phase 7 and Phase 8 respectively; no changes needed for the folder migration.                                                                                                                       |

## Acceptance for each migrated slice

- The route/procedure and response contract are unchanged unless the feature
  issue explicitly authorizes a behavior change.
- Domain code imports no Next.js, React, tRPC, Drizzle, schema, or filesystem
  implementation; feature SQL and schema imports are confined to its repository.
- The repository has explicit read projections and write commands. Tests cover
  scope, missing/conflict paths, relevant constraints, and rollback for writes.
- Transport tests confirm safe error mapping and unchanged validation behavior.
  Run `pnpm check:<app>` for each affected app; run focused E2E when the changed
  operation drives an important user flow.
- The PR records the old-to-new file map and any deliberately unmoved code.
  Update the [candidate register](./architecture-audit.md#shared-candidate-register)
  with validation outcomes after the second app; update
  [ARCHITECTURE.md](../../ARCHITECTURE.md) only for conventions actually adopted.

## Phase 3 closure versus implementation

The Phase 3 audit already marks the inventory and decisions complete. Its
remaining checklist includes Docker baseline verification, maintainer review,
merge, and milestone closure. Those status items should be checked against the
actual issue/PR state before marking Phase 3 complete. The folder and boundary
work above is the implementation of Phase 3's decision, tracked in Phase 6;
it is not a missing Phase 3 deliverable under the current roadmap.
