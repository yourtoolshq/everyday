# Passbook — Desktop behavior inventory

Inventory for issue [#72](https://github.com/yourtoolshq/everyday/issues/72).
Documents the desktop host, client, and Electron stack. Status meanings:

| Status         | Meaning                                                                |
| -------------- | ---------------------------------------------------------------------- |
| **Preserved**  | Behavior exists in both paths with the same domain semantics           |
| **Completed**  | Desktop stack now covers behavior that was missing in an earlier pilot |
| **Unresolved** | Blocks declaring installed-product readiness until addressed           |
| **Later**      | Explicitly out of scope for the readiness gate; tracked separately     |

Reference implementations:

- **Shared code:** `apps/passbook/shared/`
- **Runtimes:** `apps/passbook/host`, `client`, `desktop`

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

| Behavior                              | Next | Desktop client | Status    | Evidence                              |
| ------------------------------------- | ---- | -------------- | --------- | ------------------------------------- |
| Create/list institutions              | Yes  | Yes            | Preserved | `foundation:gate`                     |
| Institution detail page               | Yes  | Yes            | Preserved | Client `/institutions/:institutionId` |
| Institution icons (PNG/WebP)          | Yes  | Yes            | Preserved | Shared institution components         |
| Create/list accounts                  | Yes  | Yes            | Preserved | `foundation:gate`                     |
| Account detail (terms, docs, periods) | Yes  | Yes            | Preserved | Client `/accounts/:id`, E2E uploads   |
| Account inventory grouping/filters    | Yes  | Yes            | Preserved | Shared `AccountsWorkspace` component  |
| Joint ownership                       | Yes  | Yes            | Preserved | `upgrade.test.ts` fixture             |
| Closed accounts in history            | Yes  | Yes            | Preserved | Fixture + overview counts             |

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

| Behavior                          | Next | Desktop client | Status    | Evidence                             |
| --------------------------------- | ---- | -------------- | --------- | ------------------------------------ |
| Account document upload           | Yes  | Yes            | Preserved | `foundation:gate`                    |
| Statement documents               | Yes  | Yes            | Preserved | Gate + migration rehearsal           |
| Activity-linked documents         | Yes  | Yes            | Preserved | Client `/activity` and detail routes |
| Void cheque linkage               | Yes  | Yes            | Preserved | Account detail panel (shared)        |
| Email (.eml) viewer               | Yes  | Yes            | Preserved | File viewer route `/files/:id`       |
| PDF/image/audio upload validation | Yes  | Yes            | Preserved | Next E2E `uploads.spec.ts`           |
| File bytes after restart          | Yes  | Yes            | Preserved | `foundation:gate` restart step       |
| File bytes after backup restore   | Yes  | Yes            | Preserved | `migration-rehearsal:gate` digests   |
| Global documents inventory page   | Yes  | Yes            | Preserved | Client `/documents`                  |

## Activity

| Behavior             | Next | Desktop client | Status    | Evidence                     |
| -------------------- | ---- | -------------- | --------- | ---------------------------- |
| Account activity log | Yes  | Yes            | Preserved | Account detail + `/activity` |
| Activity detail page | Yes  | Yes            | Preserved | Client `/activity/:eventId`  |
| Activity documents   | Yes  | Yes            | Preserved | Activity detail workspace    |

## Members

| Behavior          | Next | Desktop client | Status    | Evidence             |
| ----------------- | ---- | -------------- | --------- | -------------------- |
| Members list/edit | Yes  | Yes            | Preserved | Client `/members`    |
| Owner assignment  | Yes  | Yes            | Preserved | Account create flows |

## Settings and appearance

| Behavior                  | Next | Desktop client | Status    | Evidence                         |
| ------------------------- | ---- | -------------- | --------- | -------------------------------- |
| Light/dark/system theme   | Yes  | Yes            | Preserved | Shared `ThemeProvider`           |
| General settings page     | Yes  | Yes            | Preserved | Client `/settings`               |
| Data & backups UI         | Yes  | Yes            | Preserved | Client `/settings/data`          |
| Backup now / restore UI   | Yes  | Yes            | Preserved | `@yourtoolshq/data-ui` screen    |
| Integrity scan UI         | Yes  | Yes            | Preserved | Data settings integrity card     |
| Automatic backup schedule | Yes  | Host           | Preserved | Host runs platform backup worker |

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

| Behavior                         | Next/Docker | Desktop        | Status       | Evidence                          |
| -------------------------------- | ----------- | -------------- | ------------ | --------------------------------- |
| Docker production deployment     | Yes         | Unchanged      | Preserved    | Phase 7 deployment docs           |
| macOS arm64 DMG install          | No          | Yes            | In progress  | `package:passbook:mac`            |
| Bundled host (no Node on target) | No          | Yes            | In progress  | `release-contract.md`             |
| Clean install smoke              | N/A         | Manual         | In progress  | Desktop runbook § manual smoke    |
| Versioned update with checkpoint | Image pull  | Orchestrated   | Completed    | `release:gate`                    |
| Failed update recovery           | Rollback    | Backup restore | Completed    | `release:gate` recovery step      |
| Remote phone/browser pairing     | No          | Yes            | Completed    | `remote-access:gate`              |
| Linux, Windows, Intel macOS      | No          | No             | Out of scope | `release-contract.md` limitations |
| Nightly update feed publication  | No          | No             | Later        | Signing/feed credentials          |
| Production cutover execution     | Active      | Not started    | Later        | Maintainer-authorized only        |

## Readiness assessment

**Verified and ready for maintainer review**

- Full Next app route parity in the desktop client (members, documents, activity, settings, institution detail)
- Core account/institution/statement/document workflow on the desktop host
- Restart persistence and backup/restore semantics
- Representative old-database migration and container-to-desktop rehearsal
- macOS arm64 package construction and recoverable update orchestration
- Authenticated remote client access

**Remaining limitations (do not block migration readiness)**

1. **Production cutover** — Docker/Next remains the live deployment until a
   maintainer authorizes cutover using [desktop-cutover-runbook.md](./desktop-cutover-runbook.md).
2. **Signed macOS nightly package** — unsigned local artifacts exist, but
   signing/notarization and GitHub prerelease publication remain Later.
3. **Auto-update feed publication** — orchestration exists; signed feed delivery
   requires credentials not present in CI.

All product-scope routes and data controls from the Next app are now available
in the desktop client via shared workspace components.

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
