# Phase 6 — Shared technical foundations plan

Planning inventory: September 2026. [ROADMAP.md](../../ROADMAP.md#phase-6--shared-technical-foundations) owns the phase goal and completion criteria. The [Phase 3 audit](../phase-3/architecture-audit.md) owns the candidate register and architectural decisions. This document turns those decisions into bounded implementation work; it does not authorize a repository-wide refactor.

## Outcome and starting point

Make established technical patterns easy to use in each independent app. Phase 4 already supplies `@yourtoolshq/data` for storage, migrations, backups, and integrity; Phase 5 supplies `@yourtoolshq/ui` and `@yourtoolshq/data-ui`. Keep their ownership intact. All four apps have their own database, schema, domain rules, deployment, and routes.

The shared TS and ESLint packages exist under `tooling/`, but the apps still copy their TypeScript options and use local `next/core-web-vitals` plus `next/typescript` ESLint configs. The current `tooling/eslint/base.ts` is a reference config with type-checked rules and a `t3-env` restriction that does not match the apps' current environment access. It cannot simply replace the app configs. The existing Phase 4 package also logs directly with `console`; any logger work must account for that package rather than duplicating the same events in every app.

The Phase 3 audit found transport errors inside Taxbook value modules and database work inside feature routers in other apps. Tenure's `paychecks` router and Taxbook's `record-values.ts` are concrete examples, not mandatory targets for wholesale migration. Pick a real change or a focused boundary problem and move one complete operation at a time.

## Implementation order

| Order | Workstream                        | Smallest useful change                                                                                                                                                                                                                           | Proof and stop point                                                                                                                                                                                                     |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Consumed tooling presets          | Compare effective TS and ESLint settings; remove unused template-only rules; migrate one app, then the others to the workspace presets with narrow local overrides. Keep the current import alias and Next-specific settings.                    | Before/after effective configs and the affected `pnpm check:<app>` pass. No broad lint autofix or new rule set bundled with the migration.                                                                               |
| 2     | One vertical slice and repository | In an actively changed feature, separate a transport adapter, application operation, domain rule, and concrete repository only where each has work to do. Start with one read and one write, including a transaction if the operation needs one. | Repository tests use a disposable SQLite database; transport tests show unchanged response and error behavior. The resulting change is easier to review than the former router/value module.                             |
| 3     | Error vocabulary                  | Define a small transport-neutral set for invalid input, missing record, conflict, and unexpected failure. Map these at tRPC and HTTP boundaries, initially for the pilot operation. Preserve existing user-facing copy and Zod field errors.     | The same application error maps correctly through each transport actually used by that operation; unexpected errors do not expose internals. Promote a shared primitive only after a second app uses the same semantics. |
| 4     | Structured server logging         | Define a minimal event shape with level, app, operation, outcome, duration when useful, and a small allow-list of safe context. Pilot at one app boundary and the relevant Phase 4 data event source.                                            | Container stdout/stderr is readable and one failure can be traced without recording names, document contents, tokens, raw requests, or sensitive identifiers. No duplicate logs for a single failure.                    |
| 5     | Repeat adoption                   | Apply the proven slice/repository and error/logging conventions to a second distinct app when a real feature change justifies it. Record any differences that should stay local.                                                                 | Two consumers demonstrate the common contract. Extract only the stable, transport-neutral portion into a small package if copying it would otherwise continue.                                                           |

These are reviewable increments, not a requirement to move every router during this phase. Group related active work into a small number of milestone issues as described in [DEVELOPMENT.md](../../DEVELOPMENT.md#shared-candidate-discovery); link back to the Phase 3 candidate register. The first issue can cover tooling adoption, the second the pilot feature boundary, and the third cross-app validation and any justified extraction.

## Technical contract

### App-local feature boundaries

Follow [ARCHITECTURE.md](../../ARCHITECTURE.md#application-architecture-direction). Routes and tRPC routers parse requests, call an application operation, and map its result or error. Domain code has no framework, transport, or persistence imports. A feature repository alone imports its Drizzle schema and runs feature queries. It selects explicit fields for read DTOs and accepts explicit write commands; do not return unrestricted rows or spread a request object into an insert/update. An application operation owns sequencing, scope checks, and transaction boundaries. A concrete repository is sufficient until a second adapter really exists.

Do not create empty `domain/application/infrastructure/presentation` directories for a small feature. Do not move existing code merely to satisfy a directory shape. For the pilot, choose a bounded operation with a real boundary problem and an existing test path. Keep cross-app HTTP integration as HTTP; do not introduce shared domain objects between apps.

### What can become shared

| Candidate            | Promote when                                                                                | Remains app-owned                                            |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| TS/ESLint presets    | The apps consume one tested base with necessary Next and app overrides.                     | Path aliases, environment choices, exceptional rules.        |
| Error primitives     | Two apps need identical status semantics without importing tRPC/Next into application code. | Domain wording, field validation, HTTP/tRPC adapters.        |
| Logger               | Two server consumers need the same safe event format and output behavior.                   | Which domain events matter and their permitted context.      |
| Test helpers         | A repeated setup removes meaningful boilerplate in two apps without hiding data isolation.  | Domain fixtures and journeys.                                |
| Database conventions | A checklist or helper survives two real schema/query changes.                               | Schemas, migrations, constraints, queries, and transactions. |

Prefer documentation and app-local examples when a package would only wrap one caller. If a shared package is justified, use explicit exports, server-only boundaries for Node/database code, and a dependency direction from apps to packages. Avoid a generic CRUD repository, DI container, result framework, shared database, or mandatory app-wide rewrite.

## Validation and safety

- Use fictional fixtures and disposable databases. Never run migration or repository validation against production data or production Docker volumes.
- For tooling changes, compare effective settings first and run `pnpm check:<app>` after each app migration. Run `pnpm check` before considering the cross-app work complete.
- For the pilot write, test field projection, ownership/scope, conflict and not-found paths, transaction rollback, and database constraints that protect its invariants. Test the application operation separately only when that adds evidence beyond the repository test.
- For errors, verify the public HTTP/tRPC status and safe message. Preserve current client handling; do not turn validation failures into generic server errors.
- For logging, capture representative success and failure output and inspect the fields for private data. Keep detailed error causes in server output only when safe; never include full request bodies, uploaded file names, document text, or raw database rows by default.
- Run targeted E2E only when a migrated operation changes a user flow. Phase 4's backup/restore and migration tests remain the authority for data durability; Phase 7 owns container and deployment standardization.

## Completion and handoff

Phase 6 is complete when all four apps consume maintained TS/ESLint presets, at least two real feature operations demonstrate the app-local boundary/repository convention, and transport-neutral errors and structured logging work in the adopted paths. Any newly promoted technical package must have more than one real consumer. Document cases that remain app-local and why. The intended result is less copy/paste for the next feature, with no change to app data ownership or independent deployment.

### Implementation status (2026-09-28)

| Gate                                                                                           | Status                                                 |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| All four apps consume `@yourtoolshq/tsconfig/nextjs` and `@yourtoolshq/eslint-config/next-app` | Done                                                   |
| Tenure paycheck read (`listByEmployment`) + write (`create`) vertical slice                    | Done                                                   |
| Taxbook record read (`listByTaxItem`) + write (`delete`) vertical slice                        | Done                                                   |
| Passbook institution read (`list`) + write (`create`) vertical slice                           | Done                                                   |
| First Aid care-providers read (`overview`) + write (`createOrganization`) vertical slice       | Done                                                   |
| `@yourtoolshq/server` errors + logging with all four apps and `@yourtoolshq/data` consumers    | Done                                                   |
| Remaining routers/value modules stay on prior patterns until touched                           | Intentional — migrate the next feature when it changes |
| Docker/networking/runtime alignment                                                            | Left for Phase 7                                       |
| Release automation                                                                             | Left for Phase 8                                       |

Before closing, update [ARCHITECTURE.md](../../ARCHITECTURE.md) to describe only the conventions and packages actually adopted, update the Phase 3 candidate register with validation outcomes, and leave Docker/networking/runtime deployment alignment for Phase 7. Phase 8 still owns release automation and rollback orchestration.
