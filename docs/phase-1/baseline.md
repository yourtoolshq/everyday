# Phase 1 — Pre-import Baseline

Recorded before importing applications into the monorepo. Original repositories remain untouched production environments.

## Source commit SHAs

| Application | Repository | SHA | Message |
|---|---|---|---|
| Taxbook | `yourtoolshq/taxbook` | `a22a2d35342f77b7f09deecb65a4a65755ce332a` | Document explicit /etc/hosts entries for tools.local apps. |
| Passbook | `yourtoolshq/passbook` | `c624c2904f9f9e9a7927c5bc44bf0d7c7325b827` | Document explicit /etc/hosts entries for tools.local apps. |
| Tenure | `yourtoolshq/tenure` | `1be3cbddfcb6bc4119cd8bd89ebc9ba19ad4f92c` | Document explicit /etc/hosts entries for tools.local apps. |
| First Aid | `yourtoolshq/firstaid` | `b41a8c85a8f58b06691cea4d48fc317832ed7df9` | Add benefits, claims, and visit cost tracking for Phase 4. |

## Git status (all clean)

All four source repositories reported a clean working tree at import time.

## Development ports

| Application | Dev port | Docker host port | Traefik host |
|---|---|---|---|
| Taxbook | 3000 | 3000 | `taxbook.tools.local` |
| First Aid | 3001 | 3001 | — |
| Passbook | 3002 | 3002 | `passbook.tools.local` |
| Tenure | 3003 | 3003 | `tenure.tools.local` |

## Package manager

All applications use `pnpm@10.28.2`.

## Validation data

SQLite backups and document directories for verification must be stored outside Git under `.validation/` (gitignored). Never attach validation containers to production volume names (`taxbook-data`, `passbook-data`, `tenure-data`, `firstaid-data`).
