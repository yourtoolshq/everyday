# Passbook Changelog

User-visible changes only. See [DEVELOPMENT.md](../../DEVELOPMENT.md) for changelog policy.

## Unreleased

### Added

- A migration rehearsal gate (`pnpm migration-rehearsal:gate`) verifies container-to-desktop backup restore with record and document digest checks.
- Desktop readiness docs cover the full behavior inventory and reviewed cutover runbook without authorizing production migration.
- Linux AppImage packaging bundles the desktop shell, client, and standalone host without developer tooling.
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

- Clicking anywhere in a statement period cell now activates its action, not just the label.
