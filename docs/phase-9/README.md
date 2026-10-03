# Phase 9 — Desktop and client/host foundation

Planning baseline for the first Passbook foundation wave: a standalone host, a
separate React client, and an Electron desktop shell. This package defines
contracts and task briefs only; it does not migrate applications or implement
the runtime.

Issue: [#63](https://github.com/yourtoolshq/everyday/issues/63).

## Architectural direction

Read together with the ADRs:

| Record                                                          | Direction                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| [ADR-0001](../adr/0001-independent-desktop-applications.md)     | Four independent desktop products with shared foundations |
| [ADR-0002](../adr/0002-app-owned-hosts-and-multiple-clients.md) | Each app owns a host; clients connect locally or remotely |
| [ADR-0003](../adr/0003-managed-releases-and-safe-updates.md)    | Prebuilt releases with recoverable updates                |

Phase goals and sequencing remain in [ROADMAP.md](../../ROADMAP.md#phase-9--distribution-future).
Phase 4 owns data durability; Phase 7 owns container deployment; Phase 8 owns
release automation. This baseline prepares implementation work that builds on
those phases without declaring them complete.

## Execution package

| Document                                                 | Purpose                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Implementation baseline](./baseline.md)                 | Target platform, technical choices, migration boundaries, smallest Passbook workflow |
| [Host/client/desktop contracts](./contracts.md)          | Shared lifecycle, configuration, readiness, errors, and representative examples      |
| [Host foundation brief](./task-host.md)                  | Standalone Passbook host assignment                                                  |
| [Client foundation brief](./task-client.md)              | Standalone Passbook client assignment                                                |
| [Desktop shell brief](./task-desktop.md)                 | Electron wrapper assignment                                                          |
| [Integration and dependency plan](./integration-plan.md) | Parallel ownership, stubs, integration gate, Ready/Blocked/Later table               |

## Maintainer gate

Foundation implementation tasks stay **Blocked** until the maintainer reviews
this baseline and marks the Ready/Blocked/Later table in
[integration-plan.md](./integration-plan.md). Approval of the ADR direction alone
does not authorize runtime work.

## Verification

Documentation changes run:

```bash
pnpm check
```

Check local links after editing. If an unrelated repository failure prevents
completion, record the exact failure in the issue handoff; do not change unrelated
app code to make planning checks pass.
