# Passbook — Desktop behavior inventory

Inventory for issue [#72](https://github.com/yourtoolshq/everyday/issues/72).
Compares the production Next.js/Docker deployment against the new host, client,
and desktop stack. Status meanings:

| Status         | Meaning                                                                |
| -------------- | ---------------------------------------------------------------------- |
| **Preserved**  | Behavior exists in both paths with the same domain semantics           |
| **Completed**  | Desktop stack now covers behavior that was missing in an earlier pilot |
| **Unresolved** | Blocks declaring installed-product readiness until addressed           |
| **Later**      | Explicitly out of scope for the readiness gate; tracked separately     |

Reference implementations:

- **Next (production):** `apps/passbook/src/app/**`, Docker image
- **Desktop stack:** `apps/passbook/host`, `client`, `desktop`

Automated evidence: `pnpm foundation:gate`, `pnpm release:gate`,
`pnpm remote-access:gate`, `pnpm migration-rehearsal:gate`.

## Onboarding and household

| Behavior                      | Next | Desktop client | Status    | Evidence                                      |
| ----------------------------- | ---- | -------------- | --------- | --------------------------------------------- |
| First-time household setup    | Yes  | Yes            | Preserved | `foundation:gate`, Playwright foundation spec |
| Second setup rejected (409)   | Yes  | Yes            | Preserved | `foundation-gate.mjs`                         |
| Household name and members    | Yes  | Yes            | Preserved | `upgrade.test.ts`, migration rehearsal        |
| Setup gate before main routes | Yes  | Yes            | Preserved | `RequireHousehold`, `AuthGate`                |

## Institutions and accounts

| Behavior                              | Next | Desktop client | Status     | Evidence                             |
| ------------------------------------- | ---- | -------------- | ---------- | ------------------------------------ |
| Create/list institutions              | Yes  | Yes            | Preserved  | `foundation:gate`                    |
| Institution detail page               | Yes  | No route       | Unresolved | Next `/institutions/[id]` only       |
| Institution icons (PNG/WebP)          | Yes  | Partial        | Unresolved | API works; SPA institution list only |
| Create/list accounts                  | Yes  | Yes            | Preserved  | `foundation:gate`                    |
| Account detail (terms, docs, periods) | Yes  | Yes            | Preserved  | Client `/accounts/:id`, E2E uploads  |
| Account inventory grouping/filters    | Yes  | Yes            | Preserved  | Shared `AccountsWorkspace` component |
| Joint ownership                       | Yes  | Yes            | Preserved  | `upgrade.test.ts` fixture            |
| Closed accounts in history            | Yes  | Yes            | Preserved  | Fixture + overview counts            |

## Statements and completeness

| Behavior                               | Next | Desktop client | Status    | Evidence                              |
| -------------------------------------- | ---- | -------------- | --------- | ------------------------------------- |
| Statement frequency per account        | Yes  | Yes            | Preserved | Domain libs + account detail          |
| Expected period derivation             | Yes  | Yes            | Preserved | `expected-periods.ts`                 |
| Statement upload by period             | Yes  | Yes            | Preserved | `foundation:gate`                     |
| Duplicate period rejected              | Yes  | Yes            | Preserved | Next E2E `uploads.spec.ts`            |
| Missing statements on overview         | Yes  | Yes            | Preserved | `overview.statementStatus` gate       |
| Period exceptions                      | Yes  | Yes            | Preserved | Fixture `statement_period_exceptions` |
| Statement completeness after migration | Yes  | Yes            | Preserved | `migration-rehearsal:gate`            |

## Documents and files

| Behavior                          | Next | Desktop client | Status     | Evidence                           |
| --------------------------------- | ---- | -------------- | ---------- | ---------------------------------- |
| Account document upload           | Yes  | Yes            | Preserved  | `foundation:gate`                  |
| Statement documents               | Yes  | Yes            | Preserved  | Gate + migration rehearsal         |
| Activity-linked documents         | Yes  | No route       | Unresolved | Next `/activity` only              |
| Void cheque linkage               | Yes  | Yes            | Preserved  | Account detail panel (shared)      |
| Email (.eml) viewer               | Yes  | Yes            | Preserved  | File viewer route `/files/:id`     |
| PDF/image/audio upload validation | Yes  | Yes            | Preserved  | Next E2E `uploads.spec.ts`         |
| File bytes after restart          | Yes  | Yes            | Preserved  | `foundation:gate` restart step     |
| File bytes after backup restore   | Yes  | Yes            | Preserved  | `migration-rehearsal:gate` digests |
| Global documents inventory page   | Yes  | No route       | Unresolved | Next `/documents` only             |

## Activity

| Behavior             | Next | Desktop client | Status     | Evidence                     |
| -------------------- | ---- | -------------- | ---------- | ---------------------------- |
| Account activity log | Yes  | Partial        | Unresolved | Panel on account detail only |
| Activity detail page | Yes  | No route       | Unresolved | Next `/activity/[eventId]`   |
| Activity documents   | Yes  | Partial        | Unresolved | API exists; no SPA workflow  |

## Members

| Behavior          | Next | Desktop client | Status     | Evidence             |
| ----------------- | ---- | -------------- | ---------- | -------------------- |
| Members list/edit | Yes  | No route       | Unresolved | Next `/members` only |
| Owner assignment  | Yes  | Yes            | Preserved  | Account create flows |

## Settings and appearance

| Behavior                  | Next | Desktop client | Status     | Evidence                         |
| ------------------------- | ---- | -------------- | ---------- | -------------------------------- |
| Light/dark/system theme   | Yes  | Yes            | Preserved  | Shared `ThemeProvider`           |
| General settings page     | Yes  | No route       | Unresolved | Next `/settings`                 |
| Data & backups UI         | Yes  | No route       | Unresolved | Next `/settings/data`            |
| Backup now / restore UI   | Yes  | CLI/API only   | Unresolved | `yt-data`; no SPA data screen    |
| Integrity scan UI         | Yes  | No route       | Unresolved | Next data settings only          |
| Automatic backup schedule | Yes  | Host           | Preserved  | Host runs platform backup worker |

## Data platform and controls

| Behavior                         | Next | Desktop host | Status    | Evidence                               |
| -------------------------------- | ---- | ------------ | --------- | -------------------------------------- |
| SQLite + documents on disk       | Yes  | Yes          | Preserved | Shared `@yourtoolshq/data`             |
| Drizzle migrations on boot       | Yes  | Yes          | Preserved | `upgrade.test.ts`, migration rehearsal |
| Pre-migration verified backup    | Yes  | Yes          | Preserved | `upgrade.test.ts`                      |
| `yt-data backup/verify/restore`  | Yes  | Yes          | Preserved | All gate scripts                       |
| Record relationships intact      | Yes  | Yes          | Preserved | Migration rehearsal + upgrade test     |
| Single writer per data directory | Yes  | Yes          | Preserved | Migration rehearsal stops source host  |

## Distribution, access, and updates

| Behavior                         | Next/Docker | Desktop        | Status    | Evidence                          |
| -------------------------------- | ----------- | -------------- | --------- | --------------------------------- |
| Docker production deployment     | Yes         | Unchanged      | Preserved | Phase 7 deployment docs           |
| Linux AppImage install           | No          | Yes            | Completed | `package:passbook:linux`          |
| Bundled host (no Node on target) | No          | Yes            | Completed | `release-contract.md`             |
| Clean install smoke              | N/A         | Manual         | Completed | Desktop runbook § manual smoke    |
| Versioned update with checkpoint | Image pull  | Orchestrated   | Completed | `release:gate`                    |
| Failed update recovery           | Rollback    | Backup restore | Completed | `release:gate` recovery step      |
| Remote phone/browser pairing     | No          | Yes            | Completed | `remote-access:gate`              |
| macOS / Windows packages         | No          | No             | Later     | `release-contract.md` limitations |
| Auto-update feed publication     | No          | No             | Later     | Signing/feed credentials          |
| Production cutover execution     | Active      | Not started    | Later     | Maintainer-authorized only        |

## Readiness assessment

**Verified and ready for maintainer review**

- Core account/institution/statement/document workflow on the desktop host
- Restart persistence and backup/restore semantics
- Representative old-database migration and container-to-desktop rehearsal
- Linux packaging and recoverable update orchestration
- Authenticated remote client access

**Unresolved gaps that block full product parity**

1. SPA routes for **Members**, **Documents**, **Activity**, and **Settings/Data**
   (sidebar links exist via shared shell but routes are not wired).
2. **Institution detail** and full **data-management UI** remain on the Next app only.
3. **Integrity scan** and in-app restore flows are not yet exposed in the desktop client.

These gaps do **not** invalidate data migration readiness — records, relationships,
statement maps, and document bytes are verified — but they **do** block claiming
the desktop client replaces the full production UI. Production cutover remains
**Later** until a maintainer authorizes it.

## Verification commands

```bash
pnpm check:passbook
pnpm check:passbook-host
pnpm check:passbook-client
pnpm check:passbook-desktop
pnpm foundation:gate
pnpm remote-access:gate
pnpm release:gate
pnpm migration-rehearsal:gate
```

Optional manual packaging:

```bash
pnpm package:passbook:linux
```
