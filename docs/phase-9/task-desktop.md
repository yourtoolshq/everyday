# Phase 9 — Passbook desktop shell brief

Standalone assignment to wrap the Passbook client and host in an Electron
desktop application. Read [baseline.md](./baseline.md) and
[contracts.md](./contracts.md) first.

**Status:** The initial desktop target is macOS Apple Silicon (`arm64`).
Local unsigned packaging is in scope; signing, notarization, release
publication, and the updater controller remain follow-up work.

## Required reading

- [docs/phase-9/baseline.md](./baseline.md)
- [docs/phase-9/contracts.md](./contracts.md)
- [task-host.md](./task-host.md) and [task-client.md](./task-client.md)
- ADRs [0001](../adr/0001-independent-desktop-applications.md),
  [0002](../adr/0002-app-owned-hosts-and-multiple-clients.md)

## Permitted file ownership

**May create or edit:**

- `apps/passbook/desktop/**` (Electron main, preload, builder config)
- Desktop-specific scripts and tests
- Documentation under `apps/passbook/desktop/README.md`

**Do not edit:**

- Host business logic (`apps/passbook/host/src/server/**` routers) except spawn config
- Client feature UI except loading URL/build path configuration
- Root workspace (integration owner)
- Other applications

## Requirements

1. Electron main process starts the Passbook host child process with contract
   env vars (`DATA_DIR`, `BACKUP_DIR`, `PORT`, `HOST=127.0.0.1`).
2. Wait for host health per contracts before showing the main client window.
3. Load client:
   - dev: Vite dev server URL documented by client handoff
   - prod: bundled static assets served from the loopback host
4. Inject or pass `PASSBOOK_HOST_URL` to the client (preload/contextBridge or
   query param — document choice).
5. **Window close:** hide window; host keeps running (ADR-0002).
6. **App quit:** terminate host gracefully (SIGTERM, bounded wait).
7. Present host startup failures in a dedicated error window with actionable text.
8. Use fictional app name/data in samples; desktop default `DATA_DIR` under the
   proposed OS-specific app data path once target OS is confirmed — until then
   use repo-local `./.data/desktop-test` for verification.

## Exclusions

- Code signing, notarization, release publication, and auto-update controller
  (follow-up release work)
- System tray, menu bar, multi-window
- Remote access, pairing, auth
- Spawning clients other than the embedded Passbook UI
- Linux, Windows, Intel macOS, and Mac App Store packaging

## Dependencies

| Depends on                    | Reason                    |
| ----------------------------- | ------------------------- |
| Host assignment               | Binary/script to spawn    |
| Client assignment             | UI to load                |
| macOS Apple Silicon (`arm64`) | Native Electron artifacts |

| Parallel with | Notes                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Client        | Can open Electron to client dev server while host run manually during early dev |

## Verification

```bash
# Development integration (paths from handoffs)
cd apps/passbook/desktop
pnpm dev
# Expect: host up → window shows setup → complete proof workflow
# Close window → host still responds to curl health
# Quit app → host stops
```

Implementer adds:

```bash
pnpm check:passbook-desktop   # lint, typecheck, minimal test
```

Use disposable `DATA_DIR` only.

## Acceptance criteria

- [ ] Desktop launches host + client on loopback without manual terminal steps
- [ ] Proof workflow completable inside Electron window
- [ ] Host survives window close; reconnect works on relaunch
- [ ] Quit terminates host; no orphaned listen on port
- [ ] Startup failure shows understandable error (not blank window)
- [ ] Handoff documents dev vs prod loading paths and data directory

## Stop conditions

Stop and request baseline review if:

- Target OS remains unconfirmed and native modules block development
- Electron spawns require contract changes (for example remote bind)
- Host/client paths cannot be packaged without monorepo-wide refactors
- Security sandbox prevents required loopback communication

## Handoff format

```markdown
## Desktop foundation handoff

### Deliverables

- ...

### Configuration

- host spawn command: ...
- client load URL: ...
- default DATA_DIR: ...

### Verification

- [ ] pnpm check:passbook-desktop
- [ ] proof workflow in Electron
- [ ] window-close host survival
- [ ] quit cleanup

### Contract gaps

- none | ...

### Notes for integration gate

- ...
```
