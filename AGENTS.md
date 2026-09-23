# Agent entry point — Your Tools monorepo

Read this file first, then the authoritative docs for every application you touch.

## Required reading

| Document                             | When                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| [PRODUCT.md](./PRODUCT.md)           | Platform purpose and boundaries                         |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Monorepo layout and app isolation                       |
| [DEVELOPMENT.md](./DEVELOPMENT.md)   | Workflow, checks, changelog policy, production boundary |
| [ROADMAP.md](./ROADMAP.md)           | Current platform phase and what comes next              |

## Per-application instructions

Before editing an app, read its `AGENTS.md`:

| App       | Path                                                 |
| --------- | ---------------------------------------------------- |
| Taxbook   | [apps/taxbook/AGENTS.md](./apps/taxbook/AGENTS.md)   |
| First Aid | [apps/firstaid/AGENTS.md](./apps/firstaid/AGENTS.md) |
| Passbook  | [apps/passbook/AGENTS.md](./apps/passbook/AGENTS.md) |
| Tenure    | [apps/tenure/AGENTS.md](./apps/tenure/AGENTS.md)     |

Follow links from each app's `AGENTS.md` to product, domain, and roadmap docs. Do not duplicate that content here.

## Working rules

- Keep changes **bounded** to the requested scope and affected apps.
- Use **fictional data** only — never commit personal or identifying information.
- Do **not** automatically extract shared code. Record future candidates in the
  architecture audit or phase implementation notes; create a
  `shared-candidate` issue only for actionable work in the active phase (see
  [DEVELOPMENT.md](./DEVELOPMENT.md)).
- Phase 2 does not change production deployments; legacy repos stay live until Phase 4.

## Verification

- App changes: `pnpm check:<app>`
- Platform docs/config: `pnpm check`
- E2E or Docker when the change warrants it (see [DEVELOPMENT.md](./DEVELOPMENT.md))
