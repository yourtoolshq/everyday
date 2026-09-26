# Phase 3 architecture audit and convergence decisions

Date: 2026-09-23

This document records what exists across Taxbook, First Aid, Passbook, and
Tenure, which implementations should be used as references, and which work is a
candidate for a later roadmap phase. Phase 3 makes decisions and records
evidence; it does not extract packages or reorganize application code.

## Executive assessment

The monorepo foundation is sound: the applications are independently
deployable, dependencies are mostly aligned through the pnpm catalog, and CI
can validate affected applications. The largest gap is inside the applications.
Business rules, persistence, transport, and client orchestration do not yet
follow one recognizable boundary.

Taxbook is the most mature source for domain and database practices. First Aid,
Passbook, and Tenure collectively provide the better filesystem-storage model.
Tenure and Passbook provide the clearest validated cross-domain UI candidate in
their period coverage views. Taxbook provides the only complete theme pattern.
No application currently provides a complete data durability solution because
filesystem-backed apps do not back up their documents with the database.

The target is a lightweight, DDD-inspired vertical-slice structure. It is not a
commitment to full DDD, repository interfaces for their own sake, dependency
injection, generic CRUD layers, or a repository-wide rewrite.

## Architectural decision: vertical slices and repositories

New or substantially changed features should converge toward:

```text
src/
  app/                         Next.js routes and composition
  core/                        Small app-wide concepts and infrastructure
  modules/
    <feature>/
      domain/                  Pure rules, types, and validation
      application/             Use cases and explicit DTOs
      infrastructure/          Repositories and external adapters
      presentation/            Feature UI and client orchestration
  components/ui/               Low-level visual primitives
```

Small slices can remain a few colocated files. Directories are earned by
complexity; they are not empty scaffolding every feature must reproduce.

The dependency rules are:

- Next.js routes and tRPC routers adapt transport concerns and call an
  application operation.
- Domain code imports no React, Next.js, tRPC, Drizzle, database schema, or
  filesystem implementation.
- Application operations coordinate authorization/scope checks, repositories,
  transactions, and domain rules.
- A feature repository is the only feature code that imports its Drizzle schema
  or executes SQL.
- Repositories use explicit projections and return app-facing DTOs or domain
  objects. They do not expose unrestricted rows.
- Repository writes accept explicit command shapes; request payloads are never
  spread into database writes.
- Field projection is the audit point for hiding internal or sensitive data
  before it reaches transport or UI code.
- Use one concrete repository by default. Introduce an interface only when a
  real second adapter exists.
- Database clients, transaction types, storage, logging, and common error
  primitives belong in app-local `core/infrastructure` until cross-app
  promotion is justified.

Taxbook's `domain` modules and `*-values.ts` files are the closest current
reference. They already separate many domain rules, projections, and
transactions. They should not be copied unchanged: they are large, mix some
application and repository work, and repositories should not throw tRPC-specific
errors.

Adoption is incremental. A normal localized fix does not require moving an
entire feature first. Split a slice when its current structure obstructs the
requested work or when the feature undergoes substantial change.

## Cross-application audit

### Dependencies and configuration

| App       | Current implementation                                                                             | Assessment                                                                    |
| --------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Taxbook   | Catalog versions for the common stack; newer Lucide and Sonner; adds React Table and `next-themes` | Strongest theme dependencies, but dependency drift is otherwise unintentional |
| First Aid | Catalog common stack; no Sonner or theme provider                                                  | Leanest dependency set                                                        |
| Passbook  | Catalog common stack; Sonner; PostalMime                                                           | Mostly aligned with Tenure                                                    |
| Tenure    | Catalog common stack; Sonner; PostalMime; Tiptap                                                   | App-specific rich-text dependency is justified                                |

All apps use Next.js 15, React 19, tRPC 11, Drizzle, Zod, Tailwind 4, and
shadcn/ui. The common versions are cataloged. App TypeScript and ESLint configs
remain near-copies and do not yet consume the shared presets in `tooling/`.

**Reference:** the existing pnpm catalog and tooling packages.

**Decision:** align accidental version drift and consume shared presets in
Phase 6; keep feature-specific dependencies app-local.

### Code organization and application boundaries

| App       | Current implementation                                                        | Assessment                                                                                  |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Taxbook   | `domain`, components, HTTP parsing, value modules, tRPC routers, split schema | Strongest separation; some value modules and feature components are very large              |
| First Aid | Feature component folders, `lib`, routers, single schema                      | Largest client workspaces; business orchestration often lives in components                 |
| Passbook  | Feature folders, pure period/document helpers, routers, single schema         | Reasonable feature naming; persistence and application rules remain concentrated in routers |
| Tenure    | Feature folders, rich pure helper set, routers, single schema                 | Strong pure derivation code; paycheck router and forms are large                            |

Representative pressure points are First Aid's care-plan workspace, Taxbook's
filing value module, and Tenure's paycheck router/form. File size is a signal,
not a rule: code should be divided by responsibility when it impedes a real
change.

**Reference:** Taxbook's domain/persistence split, refined into the vertical
slice and repository rules above.

### Database schema, transactions, and migrations

| App       | Schema and integrity                                                | Migration behavior                                                          |
| --------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Taxbook   | Split schema, extensive checks/indexes, explicit transactions       | Container entrypoint runs migrations; requests do not auto-migrate          |
| First Aid | Single schema, fewer database checks, limited explicit transactions | Application initialization runs migrations; entrypoint starts Next directly |
| Passbook  | Single schema with indexes and cascades                             | Entrypoint migration plus application-level migration readiness             |
| Tenure    | Single schema with indexes and cascades                             | Entrypoint migration plus application-level migration readiness             |

**Reference:** Taxbook for integrity and explicit transactions; the shared
libSQL bootstrap in the newer apps for local-directory handling and health
checks.

**Decision:** databases and schemas stay app-owned. Production runs migrations
once in the container entrypoint before Next starts. Request handling may await
readiness but must not initiate a second migration path. Phase 4 owns migration
safety; Phase 6 owns repository adoption and reusable database conventions.

### File storage and HTTP delivery

| App       | Current implementation                                                | Assessment                                                                         |
| --------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Taxbook   | Attachment bytes stored in six SQLite blob tables                     | Transactionally simple, but grows the database and is not the target storage model |
| First Aid | Managed filesystem, strict keys, signature detection, staged deletion | Strong storage and E2E reference; supports PDF/images                              |
| Passbook  | Same safe filesystem model plus EML/audio support                     | Broadest detector and strongest file-type reference                                |
| Tenure    | Same safe filesystem model plus EML support                           | Validates reuse for employment documents and pay stubs                             |

The filesystem implementations validate generated keys, prevent traversal,
create files exclusively, stage deletion for rollback, cap uploads at 25 MB,
and return private/no-store responses with `nosniff`.

**Reference:** the common behavior across First Aid, Passbook, and Tenure;
Passbook for extensible detection; First Aid for browser-level document tests.

**Decision:** Phase 4 creates one common filesystem foundation, proves it in
the three current consumers, and then migrates Taxbook. Taxbook is not retained
as a permanent exception.

### Backup, restore, and data layout

| App       | Development data                                              | Container data                                          | Current backup/restore                                                                    |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Taxbook   | Database URL must be supplied; Docker uses `/data/taxbook.db` | `taxbook-data`; attachments are database blobs          | SQLite online backup and integrity-checked restore; complete only because files are blobs |
| First Aid | `./.data/firstaid.db` and `./.data/documents`                 | `firstaid-data`, `/data/firstaid.db`, `/data/documents` | None                                                                                      |
| Passbook  | `./.data/passbook.db` and `./.data/documents`                 | `passbook-data`, `/data/passbook.db`, `/data/documents` | SQLite-only backup/restore; documents explicitly excluded                                 |
| Tenure    | `./.data/tenure.db` and `./.data/documents`                   | `tenure-data`, `/data/tenure.db`, `/data/documents`     | SQLite-only backup/restore; documents explicitly excluded                                 |

No existing implementation is sufficient. Phase 4 must produce a versioned
backup artifact containing SQLite, managed files, a file inventory, integrity
results, app identity, timestamp, and required non-secret metadata. Every app
must adopt the same foundation.

### Taxbook attachment migration inventory

Taxbook has six one-to-one attachment tables. Each contains its parent foreign
key, filename, MIME type, positive size capped at 20 MiB, and a non-null blob.
Parent deletion cascades to the attachment.

| Attachment table                     | Parent                    | Current download route                         |
| ------------------------------------ | ------------------------- | ---------------------------------------------- |
| `record_attachments`                 | `records`                 | `/api/records/[id]/attachment`                 |
| `business_record_attachments`        | `business_records`        | `/api/business-records/[id]/attachment`        |
| `tax_document_attachments`           | `tax_documents`           | `/api/tax-documents/[id]/attachment`           |
| `filing_attachments`                 | `filings`                 | `/api/filings/[id]/attachment`                 |
| `assessment_attachments`             | `assessments`             | `/api/assessments/[id]/attachment`             |
| `cra_reference_document_attachments` | `cra_reference_documents` | `/api/cra-reference-documents/[id]/attachment` |

Phase 4 must preserve parent relationships, filenames, MIME types, sizes,
inline/download behavior, cascade semantics, and current URLs. Migration should
run offline against a backup, copy before removing blobs, record a digest and
storage key, verify every byte count and digest, and retain rollback material
until the migrated application has been validated.

### Validation and error handling

| App       | Current strengths                                          | Gaps                                                                       |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Taxbook   | Strong domain schemas and explicit HTTP form parsers       | Repeated HTTP error adapters; repositories/value modules throw tRPC errors |
| First Aid | Consistent Zod/tRPC validation and several conflict checks | Error handling is repeated inside large workspaces                         |
| Passbook  | Explicit tRPC not-found/conflict handling                  | No common app error vocabulary                                             |
| Tenure    | Pure validation helpers and tRPC errors                    | No common app error vocabulary                                             |

**Reference:** Taxbook's domain validation plus the newer apps' straightforward
tRPC adapters.

**Decision:** Phase 6 defines transport-neutral application errors and maps
them at HTTP/tRPC boundaries. It does not create a generic result framework.

### Logging and observability

Taxbook logs tRPC duration; all apps use scattered console logging in error
paths. There is no consistent structured context, app identity, operation name,
or storage/migration audit log.

**Reference:** none is sufficient.

**Decision:** Phase 6 introduces a small structured server logger suitable for
container logs. A hosted telemetry platform is not required.

### UI primitives and interaction patterns

The same shadcn sidebar and most primitives are copied across all four apps.
Names and behavior for sheets, drawers, forms, feedback, and destructive
actions vary. All apps lack authored route-level `loading.tsx`, `error.tsx`,
`global-error.tsx`, and `not-found.tsx` boundaries.

Tenure's employment pay-period view is the strongest period coverage reference:
responsive density, grid/list modes, year navigation, status legend, tooltips,
accessible actions, and detail flow. Passbook's account statement-period view
proves the same visual model in a second domain.

**Decision:** Phase 5 may share a presentation-only period coverage component.
Apps retain queries, mutations, status derivation, summary wording, and detail
panels. Low-level primitives and shell patterns are separate candidates.

### Theming

Taxbook implements Geist, `next-themes`, light/dark tokens, persisted
selection, and a theme-aware toaster. First Aid, Passbook, and Tenure each have
a distinct light OKLCH palette but no active dark theme despite dark utility
classes in components.

**Reference:** Taxbook for theme mechanics; all apps for distinct brand accents.

**Decision:** Phase 5 defines shared semantic tokens and light/dark mechanics
while leaving accent values app-owned.

### Testing

| App       | Unit/integration reference                      | Browser coverage                                           |
| --------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Taxbook   | Strongest domain and database integration suite | Three long critical journeys                               |
| First Aid | Strong server/storage coverage                  | Strongest E2E suite: seven workflows on desktop and mobile |
| Passbook  | Strong period/document pure tests               | Setup only                                                 |
| Tenure    | Strong derived employment/paycheck rules        | Setup only                                                 |

**Decision:** each later phase owns its verification. Phase 4 tests backup,
restore, storage, and migration; Phase 5 tests behavior/accessibility; Phase 6
tests repositories and shared foundations; Phase 7 tests containers.

### Docker and local infrastructure

All apps use root-context `turbo prune`, standalone Next output, persistent
volumes, non-root execution, and health checks. Details differ: base image tags,
installed tools, migration entrypoints, public assets, document directory
creation, and Traefik labels. First Aid does not join the shared web network.

**Reference:** Passbook and Tenure for SQLite plus managed files; Taxbook for
explicit migration and SQLite backup behavior.

**Decision:** record differences now; standardize deployment in Phase 7 rather
than creating a universal Dockerfile during Phase 3.

### Authentication and exposure

All procedures and document routes are unauthenticated. Compose port bindings
are loopback-only, which matches the current personal/local deployment model.

**Reference:** none is sufficient for public exposure.

**Decision:** unauthenticated services must stay on loopback or a trusted
private network. Phase 7 must make that safe default explicit. Authentication
is introduced only when a concrete remote-access requirement exists.

### create-t3-turbo patterns

Adopt the ideas of explicit `apps`/`packages`/`tooling` ownership, consumed
shared presets, explicit package exports, server-only boundaries, and
generator-assisted scaffolding. Do not adopt its shared API/database ownership,
Expo, TanStack Start, Supabase, edge-runtime, or authentication machinery.
Those solve different deployment and client requirements.

## Shared-candidate register

This register is the source of truth for future implementation notes. It is not
an issue-per-row backlog. When a phase begins, related rows should be grouped
into a small number of detailed implementation issues that link back here.

| Candidate                               | Current source/reference                               | Reference weakness                                | Consumers                          | Keep app-local                                | Phase | Validation before promotion                                       | Non-goals                                            |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | ---------------------------------- | --------------------------------------------- | ----- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Vertical-slice convention               | Taxbook domain/value separation                        | Not a complete slice; some large mixed modules    | All apps                           | Domain vocabulary and feature layout details  | 6     | Apply to one obstructive feature and confirm fixes become simpler | Repository-wide move or full DDD                     |
| Repository and explicit DTO convention  | Taxbook `*-values.ts` projections/transactions         | Mixes application, persistence, and tRPC errors   | All apps                           | Queries and DTOs for each domain              | 6     | Prove field allow-listing, transaction use, and test ergonomics   | Generic CRUD/base repository or DI container         |
| Migration/readiness convention          | Taxbook entrypoint; newer app health/bootstrap         | Later apps can invoke migrations twice            | All apps                           | Each schema and migration history             | 4     | Fresh and upgraded disposable volumes; failed migration recovery  | Shared database or request-time production migration |
| Database integrity checklist            | Taxbook checks, indexes, transactions                  | More complex and inconsistent inside Taxbook      | All apps                           | Actual constraints and transaction boundaries | 4/6   | Apply to new schema work and review query plans                   | Identical schemas                                    |
| Filesystem document store               | First Aid/Passbook/Tenure storage modules              | Extension policy duplicated; no reconciliation    | All apps                           | Allowed types and domain metadata             | 4     | Failure injection, staged-delete recovery, permission tests       | General file cabinet or cloud storage                |
| File detection and response helpers     | Passbook detector; shared safe file route shape        | EML/audio fallback can trust extensions           | File-using apps                    | Allowed type policy                           | 4/6   | Malformed file, header injection, range/large-file behavior       | Antivirus or content interpretation                  |
| Complete backup artifact                | Taxbook SQLite scripts plus filesystem apps            | No implementation includes DB and files           | All apps                           | App identifiers and optional metadata         | 4     | Restore into empty volume and compare manifest/digests            | Separate manual document backup                      |
| Restore/reconciliation/usage foundation | Staged deletion and storage metadata                   | No orphan scan, usage report, or verified restore | All apps                           | Domain-specific ownership reporting           | 4     | Missing/orphaned files and interrupted restore tests              | Background cloud synchronization                     |
| Semantic theme contract                 | Taxbook theme mechanics; four palettes                 | Only Taxbook has dark tokens                      | All apps                           | App accent and brand identity                 | 5     | Contrast, hydration, system/light/dark, toaster tests             | One identical palette                                |
| Period coverage presentation            | Tenure pay-period and Passbook statement-period views  | Domain state and data operations are embedded     | Tenure, Passbook; possible Taxbook | Status derivation, actions, summary copy      | 5     | Extract presentation API against both current consumers           | Generic scheduler/calendar                           |
| UI primitives and shell                 | Exact/copied shadcn primitives and sidebar             | Copies have already drifted                       | All apps                           | Feature wrappers and navigation items         | 5     | Visual/responsive regression checks in two apps                   | Large design-system framework                        |
| Feedback states                         | Existing local loading/errors/dialogs                  | No route-level boundaries or shared guidance      | All apps                           | Domain-specific recovery actions              | 5     | Server error, retry, empty, pending, destructive action cases     | Universal state machine                              |
| Error vocabulary and mapping            | Taxbook HTTP adapters; tRPC errors in all apps         | Transport details leak inward                     | All apps                           | User-facing domain messages                   | 6     | Same failure through HTTP/tRPC without leaking internals          | Generic result monad                                 |
| Structured logging                      | Taxbook timing and route error logs                    | Inconsistent and unstructured                     | All apps                           | Domain-safe context fields                    | 6     | Verify useful container output and private-field redaction        | Hosted observability platform                        |
| Test infrastructure                     | Existing Vitest/Playwright setup                       | Coverage and depth vary; root check race exists   | All apps                           | Feature fixtures and journeys                 | 6     | Representative unit, repository, E2E, and data tests              | Mandatory identical coverage percentage              |
| Consumed TS/ESLint presets              | `tooling/typescript` and `tooling/eslint`              | Apps still use local copies                       | All apps                           | Narrow overrides                              | 6     | All gates pass with identical effective rules                     | Removing app overrides                               |
| Docker/deployment template              | Four root-context Dockerfiles; Passbook/Tenure compose | Migration, tools, assets, and routing drift       | All apps                           | App name, port, data paths                    | 7     | Build, health, empty and upgraded volume tests                    | One opaque parameterized Dockerfile                  |
| Unauthenticated deployment safety       | Loopback compose bindings                              | Traefik/private-network assumptions are implicit  | All apps                           | Future auth needs                             | 7     | Confirm default install is unreachable publicly                   | Premature auth platform                              |

## Phase 4 acceptance contract

Before Phase 4 implementation is considered complete:

1. One command produces a versioned artifact containing the SQLite database,
   all managed files, and a manifest.
2. Restore succeeds into an empty disposable volume without relying on the
   source volume.
3. SQLite `pragma integrity_check` returns `ok`.
4. Manifest paths, byte sizes, and cryptographic digests match restored files.
5. The restored application starts and its health check succeeds.
6. Representative files from every supported type open through existing URLs.
7. An interrupted backup, restore, or migration cannot replace the last known
   good data set.
8. Taxbook migration verifies every copied attachment before blob retirement
   and retains rollback material through human validation.
9. The same foundation and artifact contract is used by all four apps.

## Sanitized fixture contract

Phase 4 fixtures must be generated from fictional data and cover both current
storage models:

- A minimal Taxbook SQLite database with one synthetic attachment in each of
  the six blob tables, including Unicode filenames and the maximum metadata
  shape. Existing migrations and integration helpers should generate it; do not
  commit a database copied from a real deployment.
- A filesystem-backed database with valid PDF/image/EML examples as applicable,
  a missing file, an orphan file, a staged deletion, a Unicode filename, and a
  zero-byte/invalid upload rejection case. Generate files during tests from
  deterministic byte constants rather than committing personal documents.
- A manifest fixture with stable fake app identity, paths, sizes, and digests.

The fixture specification is established here. Its executable builders belong
to Phase 4 because they must be developed with the final artifact contract.

## Quality baseline

Observed on macOS/OrbStack from a clean worktree on 2026-09-23:

| Check                           | Result                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting                      | Passed                                                                                                                                                                                                        |
| Root `pnpm check`               | Failed because build and typecheck race over `.next/types`; tracked in GitHub issue #3                                                                                                                        |
| Ordered production builds       | Passed for all four apps; Taxbook emitted one existing unused-variable warning                                                                                                                                |
| Ordered lint                    | Passed with three existing warnings: anonymous PostCSS exports in Passbook/Tenure and one unused Taxbook import                                                                                               |
| Ordered typecheck               | Passed for all apps and tooling packages                                                                                                                                                                      |
| Unit/integration tests          | Passed: Taxbook 62, First Aid 53, Passbook 54, Tenure 47 (216 total)                                                                                                                                          |
| Taxbook E2E                     | Passed: 3 journeys                                                                                                                                                                                            |
| First Aid E2E                   | Passed: 14 project runs (7 journeys on desktop and mobile)                                                                                                                                                    |
| Passbook E2E                    | Passed: setup journey only                                                                                                                                                                                    |
| Tenure E2E                      | Passed: setup journey only                                                                                                                                                                                    |
| Docker builds and health checks | Taxbook image built and passed a disposable `/api/health` check. The remaining builds are blocked by a local OrbStack BuildKit content-store error before repository build steps; tracked in GitHub issue #22 |

The root-check race is a workflow defect, not evidence of failing app types or
tests. It is intentionally tracked separately instead of being repaired as an
architecture-audit change.

## Before Phase 4

### Required readiness work

- [x] Complete the architecture audit and candidate inventory.
- [x] Record the vertical-slice and repository decision.
- [x] Record every app's database, document, volume, migration, and backup
      layout.
- [x] Inventory Taxbook attachment relationships, constraints, and routes.
- [x] Define the Phase 4 acceptance contract.
- [x] Define sanitized fixture requirements for blob and filesystem models.
- [ ] Finish the Docker-build and disposable health-check baseline after the
      local builder failure in issue #22 is resolved. Taxbook is verified;
      First Aid, Passbook, and Tenure remain unverified in this run.
- [x] Record pre-existing failures separately rather than folding them into
      Phase 4.
- [x] Map every candidate to an existing roadmap phase.
- [x] Record detailed future implementation notes with source, validation, and
      non-goals in the candidate register.
- [ ] Obtain maintainer approval of this audit and candidate set.
- [ ] Merge the Phase 3 documentation through the normal PR workflow.
- [ ] Close the Phase 3 milestone after merge.
- [ ] Create the Phase 4 milestone only when Phase 4 begins.

The unchecked items require maintainer review or the eventual merge and are not
performed unilaterally by the audit implementation.

### Optional safe work

- Correct factually stale documentation.
- Improve candidate evidence or links.
- Inspect real deployment size and file counts without copying private data.
- Fix an isolated bug that blocks baseline verification through its own issue
  and PR.
- Apply urgent security or data-loss fixes immediately.

### Work that must wait

- Creating a shared storage package or changing backup formats.
- Replacing app storage code or moving Taxbook blobs.
- Schema/migration changes for convergence.
- Reorganizing apps into vertical slices.
- Extracting UI or infrastructure packages.
- Standardizing Dockerfiles.

### Out-of-band work

The roadmap governs platform convergence, not every repository change.
Localized bugs, urgent security/data-loss work, dependency maintenance,
user-requested features, documentation corrections, and refactoring needed for
a local change continue through the normal Issue -> branch -> PR workflow. They
must not be reported as completion of a future platform phase.
