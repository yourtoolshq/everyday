# Phase 9 — Release and upgrade contract

Authoritative contract for issue [#71](https://github.com/yourtoolshq/everyday/issues/71):
installable Passbook releases and recoverable updates.

Extends [contracts.md](./contracts.md) and [ADR-0003](../adr/0003-managed-releases-and-safe-updates.md).

## Goals

- Install Passbook on the initial target (Linux x86_64) without Node, pnpm, or Docker.
- Keep application data outside installed resources under the user data directory.
- Publish traceable versioned artifacts; incomplete publication never advances an update feed.
- Upgrade between packaged releases with a verified backup checkpoint and recovery on failure.

## Initial target

| Item           | Choice                                     |
| -------------- | ------------------------------------------ |
| OS / arch      | Linux x86_64 (leading candidate)           |
| Package format | AppImage via electron-builder              |
| Host runtime   | Bundled Node host (`passbook-host.cjs`)    |
| Client assets  | Vite production build in `extraResources`  |
| Signing        | Documented prerequisite; not enabled in CI |

## Version identity

- `APP_VERSION` is set from the desktop package version at launch and recorded in
  platform status (`GET /api/data/status`).
- Release artifacts embed the same version in the AppImage filename and desktop
  metadata.
- Candidate publication requires a complete artifact set; partial uploads do not
  advance the feed.

## Data layout

| Path                                    | Owner   | Survives reinstall |
| --------------------------------------- | ------- | ------------------ |
| `{userData}/data/`                      | User    | Yes                |
| `{userData}/data/backups/`              | User    | Yes                |
| Installed resources (`extraResources/`) | Package | Replaced on update |
| Electron application bundle             | Package | Replaced on update |

Uninstall behavior follows the host OS; user data under `userData` is never
deleted automatically.

## Update lifecycle

Desktop updates follow durable stages recorded in `{dataDir}/.update/intent.json`:

1. **backup** — create and verify a pre-update backup (`yt-data backup`).
2. **trial** — start the new host build against existing data; readiness must reach
   `ready` before commit.
3. **commit** — clear update intent after successful trial.
4. **failed** — retain intent and failure reason; operator restores from the
   recorded backup id.

A reconnect alone is not treated as a successful update. Failed download or
backup leaves the previous runtime usable. Post-commit writes are not rolled back
unconditionally; downgrade implications are documented in ADR-0003.

## Packaging contents

The Linux AppImage includes:

- Electron shell (`@passbook/desktop`)
- Client static build (`client/dist`)
- Bundled host (`host/dist/passbook-host.cjs`)
- Drizzle migrations (`drizzle/`)

Development dependencies, source TypeScript, and user data are excluded.

## Verification

| Command                       | Proves                                     |
| ----------------------------- | ------------------------------------------ |
| `pnpm check:passbook-host`    | Host bundle builds and tests pass          |
| `pnpm check:passbook-desktop` | Update orchestrator and desktop tests pass |
| `pnpm release:gate`           | Bundled host, backup checkpoint, recovery  |
| `pnpm package:passbook:linux` | Produces an installable AppImage (manual)  |

## Limitations (this wave)

- macOS and Windows packages are out of scope.
- Code signing and update feed publication require credentials not present in CI.
- Auto-update UI is not wired; orchestration records intent for a later controller.
- Real old-to-new migration across schema changes is covered by existing migration
  tests; release-gate proves backup/recovery around versioned restarts.

## References

- [integration-runbook.md](./integration-runbook.md)
- [remote-access-contract.md](./remote-access-contract.md)
- [ADR-0003](../adr/0003-managed-releases-and-safe-updates.md)
