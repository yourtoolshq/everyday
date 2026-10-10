# Passbook Changelog

User-visible changes only. See [DEVELOPMENT.md](../../DEVELOPMENT.md) for changelog policy.

## Unreleased

### Added

- **Investment statement details:** For investment, TFSA, RRSP, and FHSA accounts,
  optionally record statement-reported opening and closing values, cash, and
  stock/ETF/mutual-fund holdings beside the PDF, save drafts, and mark facts as
  reviewed. The statement grid shows whether investment details are not entered,
  in draft, or reviewed separately from whether the PDF is uploaded.
- **Holdings catalog:** Reuse instruments across accounts and open source-linked
  positions from a global Holdings view, without combined household portfolio
  totals.
- **Statement comparisons:** See reported account value over time, holdings on a
  chosen date, and deterministic “What changed?” observations between two
  statements for the same account when currencies and coverage allow. Passbook
  does not show investment return percentages or live market prices.

### Changed

- Passbook is desktop-only: Docker and the Next.js app are removed. Shared code lives under `shared/`; development uses the host and client (or the desktop shell).

### Added

- A scheduled GitHub Actions release publishes macOS Apple Silicon desktop builds with generated release notes, DMG downloads, and updater metadata.
- The packaged desktop app checks GitHub for updates, creates a verified backup before installing, and resumes safely after restart.
- The desktop client now includes Members, Documents, Activity, institution detail, General settings, and Data & backups routes with the same workspace components as the Next app.
- A migration rehearsal gate (`pnpm migration-rehearsal:gate`) verifies container-to-desktop backup restore with record and document digest checks.
- Desktop readiness docs cover the full behavior inventory and reviewed cutover runbook without authorizing production migration.
- An unsigned Apple Silicon macOS DMG/ZIP package bundles the desktop shell,
  client, standalone host, and native database runtime without developer tooling.
- A release gate (`pnpm release:gate`) verifies bundled-host startup, backup checkpoints, versioned restarts, and recovery.
- Remote device pairing uses short-lived codes and bearer tokens; loopback clients remain unchanged while remote clients must pair before accessing records.
- A remote-access gate (`pnpm remote-access:gate`) verifies pairing, authorization, and revocation.
- A foundation integration gate (`pnpm foundation:gate`) verifies the host workflow, restart persistence, backup/restore, and client setup UI against disposable data.
- A standalone Passbook host runs on loopback without Next.js, serving health, tRPC, and data routes for desktop and browser clients.
- A Vite React client connects to the host for setup, overview, accounts, institutions, and file viewing without Next.js.
- A Passbook desktop shell supervises the host, loads the client, and keeps data running when the window is closed.
- Institutions can have uploaded PNG or WebP icons. Institution pages show accounts grouped by owner, including joint and unassigned accounts.

### Changed

- The Accounts inventory uses compact rows grouped by institution or owners, including distinct joint-owner groups. Active accounts show by default, with Closed and All filters and collapsible groups.
- Account term fields show a `$` or `%` prefix in the input. The prefix is visual only; saved values stay numbers.
- Credit limit and annual fee show a calculator icon. A total such as `10+12+34.5` becomes a dollar amount when you leave the field.
- Account dates can be typed, such as June 01, 2025, or chosen from the calendar. The saved value stays a calendar date.
- File upload progress uses a thinner bar.
- Appearance is on General in the sidebar. Light, dark, or system is saved. Data & backups stays storage, backups, and restores.
- A page that fails to load, is missing, or is still loading explains that and offers a way back.

### Fixed

- Update recovery now lets people continue to Passbook or open Data & backups.
  It no longer claims a backup exists when backup creation itself failed.
- The desktop update recovery screen no longer crashes to a blank window after
  an update verification failure.
- Desktop update releases now use a Passbook-specific SemVer channel, so the
  updater can find them in the monorepo's shared GitHub release feed.
- The desktop sidebar now always shows the installed version, checks GitHub for
  updates as soon as it starts, and provides a retryable manual update check.
- Desktop backups now default to a sibling backup folder instead of living
  inside the desktop data directory.
- macOS packaging no longer fails on pnpm workspaces when electron-builder tries to rebuild transitive native dependencies such as `@emnapi/core`.
- Clicking anywhere in a statement period cell now activates its action, not just the label.
