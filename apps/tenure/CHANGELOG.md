# Tenure Changelog

User-visible changes only. See [DEVELOPMENT.md](../../DEVELOPMENT.md) for changelog policy.

## Unreleased

### Added

### Changed

- Compensation amount fields show a `$` prefix, and commission fields show a `%` prefix. The prefix is visual only.
- File upload progress uses a thinner bar.
- Appearance is on General in the sidebar. Light, dark, or system is saved. Data & backups stays storage, backups, and restores.
- Paycheck amounts accept a number or a simple `+ - * /` expression and normalize when you leave the field.
- Pay periods no longer repeat a paycheck list under the grid. Open a period to view, edit, or delete its paychecks. The list control still switches the whole year.
- A page that fails to load, is missing, or is still loading explains that and offers a way back.

### Fixed

- Saving pay frequency updates the paycheck periods on the employment page without a manual reload.
