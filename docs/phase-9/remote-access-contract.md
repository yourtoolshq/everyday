# Phase 9 — Remote access contract

Authoritative contract for issue [#70](https://github.com/yourtoolshq/everyday/issues/70):
authenticated browser and phone access to the Passbook host.

Extends [contracts.md](./contracts.md) foundation-1. Local loopback behavior is
unchanged unless `PASSBOOK_REQUIRE_AUTH=1` is set for testing.

## Goals

- A phone or browser on the same private network can access the same host-owned
  records after explicit pairing.
- Unauthenticated remote clients cannot read or mutate data, backups, or admin
  endpoints.
- The host owner can revoke access without restarting the host.
- Local desktop use requires no cloud account and remains usable on loopback
  without pairing.

## Network boundary

| Mode | Host bind | Remote clients | Auth |
| ---- | --------- | -------------- | ---- |
| Local (default) | `127.0.0.1` | Not reachable | Loopback exempt |
| Private LAN | `0.0.0.0` with `PASSBOOK_REMOTE_ACCESS=1` | Same subnet / VPN | Bearer token required |
| Public internet | **Out of scope** | Not supported | Do not expose without reverse proxy + TLS |

TLS termination is the operator's responsibility (reverse proxy, Caddy, etc.).
The host serves plain HTTP; pairing codes must not be transmitted over untrusted
networks without TLS in front.

## Pairing and tokens

1. **Create code** — `POST /api/auth/pairing-codes` (loopback only) returns a
   short-lived numeric code (5 minutes).
2. **Pair device** — `POST /api/auth/pair` with `{ "code": "…", "label": "…" }`
   returns `{ "token": "…", "id": "…" }`. Callable from remote clients.
3. **Use token** — Remote requests send `Authorization: Bearer <token>`.
4. **Revoke** — `DELETE /api/auth/tokens/:id` (loopback only).

Tokens are opaque, stored hashed on disk under `{DATA_DIR}/auth/`. Revocation is
immediate; revoked tokens receive `401` on the next request.

## Authorization model

| Surface | Loopback | Remote (paired) |
| ------- | -------- | --------------- |
| `/api/health` | Full | Summary only (`status`, `auth`) |
| `/api/auth/pair` | Allowed | Allowed |
| `/api/auth/pairing-codes` | Allowed | Denied (`403`) |
| `/api/auth/tokens` | List/revoke | Denied |
| `/api/trpc/*`, `/api/data/*` | Allowed | Requires bearer token |

Destructive backup/restore operations follow the same boundary: remote paired
clients may use data APIs allowed by tRPC; token administration remains
loopback-only.

## Client behavior

- **Local client** (desktop, `127.0.0.1`): no token; unchanged workflow.
- **Remote client**: must complete `/pair` before `HostGate` loads the app.
- **Auth expired / revoked**: show reconnect screen; clear stored token; do not
  replay queued mutations.
- **Stale edits**: clients refetch on focus; server remains authoritative (no
  offline replica).

## Session policy

- Tokens do not expire by time; they remain valid until revoked.
- One token per paired device label; re-pairing creates a new token.
- Host unavailable: clients show offline state; no local data fork.

## Verification

```bash
cd apps/passbook && pnpm remote-access:gate
```

See [integration-runbook.md](./integration-runbook.md) for manual phone testing.

## Limitations (this wave)

- No OAuth, cloud accounts, or native mobile app.
- No automatic TLS from the host.
- No fine-grained per-route permissions (paired token is full app access).
- Concurrent edit conflicts use last-write-wins at the server.
