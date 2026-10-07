# AGENTS.md

Read the project docs before making product or domain decisions:

- `README.md`
- `docs/PRODUCT.md`
- `docs/DOMAIN.md`
- `docs/ROADMAP.md`

Treat those files as the source of truth for scope, terminology, boundaries, and roadmap intent.

For implementation conventions — UI patterns, tRPC usage, migrations, testing — read [`docs/ENGINEERING.md`](docs/ENGINEERING.md).

## Structure

Passbook ships as a **desktop app** (host + Vite client + Electron). Product code that is not a runtime shell lives under **`shared/`** (`lib/`, `server/`, `components/`). Monorepo-wide libraries stay in root **`packages/`** (`@yourtoolshq/*`). Do not add Passbook-only packages under root `packages/` unless multiple Everyday apps need the same code.

| Path       | Role                                                              |
| ---------- | ----------------------------------------------------------------- |
| `host/`    | Loopback HTTP, auth, bundled API                                  |
| `client/`  | SPA routes and tRPC client                                        |
| `desktop/` | Electron packaging and updates                                    |
| `shared/`  | Passbook domain + UI shared by client (and typechecked from host) |

## Before starting a phase

Do not implement an entire roadmap phase automatically.

First discuss the current problem with the user and agree on the smallest version that is useful right away.

Prefer solving the real personal workflow over overbuilding or prematurely productizing the app.

## Privacy

This is an open-source repository.

Personal information shared during development is context only and must not be copied into the repo.

Use generic or fictional examples in code, tests, seed data, screenshots, and documentation.
