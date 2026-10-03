# Passbook desktop

Electron shell that supervises the Passbook host and loads the client UI.

## Development

```bash
cd apps/passbook/desktop
pnpm dev
```

`pnpm dev` builds the Electron main/preload bundle, starts the Vite client on
`http://127.0.0.1:5173`, then opens Electron after a short delay.

## Configuration

| Variable                      | Default                            | Purpose                                     |
| ----------------------------- | ---------------------------------- | ------------------------------------------- |
| `DATA_DIR`                    | `apps/passbook/.data/desktop-test` | Disposable app data for verification        |
| `BACKUP_DIR`                  | `<DATA_DIR>/backups`               | Backup location                             |
| `HOST`                        | `127.0.0.1`                        | Host bind address                           |
| `PORT`                        | `3847`                             | Host listen port                            |
| `PASSBOOK_CLIENT_DEV_URL`     | `http://127.0.0.1:5173`            | Client URL in development                   |
| `PASSBOOK_DESKTOP_USE_DIST`   | unset                              | Set to `1` to load bundled client assets    |
| `PASSBOOK_LEAVE_HOST_RUNNING` | unset                              | Set to `1` to keep the host running on Quit |

Host spawn command:

```bash
node --import tsx apps/passbook/host/src/index.ts
```

`PASSBOOK_HOST_URL` is injected into the renderer through the preload bridge
(`window.passbookDesktop.hostUrl`).

## Behavior

- Starts the host before opening the window unless a healthy host is already
  listening on the configured loopback port.
- Closing the window hides it; the host keeps running so a relaunch reconnects
  without spawning a second writer.
- Quitting the app sends SIGTERM to a host started by this launch only. External
  hosts are left running.
- A second desktop launch focuses the existing window instead of spawning
  another host.
- External navigation is blocked; only the configured client and host origins are
  allowed.
- Host startup failures show a dedicated error window with actionable text.

## Verification

```bash
pnpm check:passbook-desktop
```

Manual checks with fictional data:

1. `pnpm dev` — setup workflow loads in Electron.
2. Close the window — `curl http://127.0.0.1:3847/api/health` still succeeds.
3. Relaunch — client reconnects without a port conflict.
4. Quit — host stops and the port is free.
5. Start the host manually, then launch desktop — desktop connects without
   spawning a second host; Quit leaves the manual host running when it was not
   started by the shell.
