# Agent entry point — Your Tools monorepo

Read this file first, then the authoritative docs for every application you touch.

## Required reading

| Document                                   | When                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| [PRODUCT.md](./PRODUCT.md)                 | Platform purpose and boundaries                         |
| [ARCHITECTURE.md](./ARCHITECTURE.md)       | Monorepo layout and app isolation                       |
| [DEVELOPMENT.md](./DEVELOPMENT.md)         | Workflow, checks, changelog policy, production boundary |
| [ROADMAP.md](./ROADMAP.md)                 | Current platform phase and what comes next              |
| [DESIGN_LANGUAGE.md](./DESIGN_LANGUAGE.md) | UI and interaction choices when working on an app       |

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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
