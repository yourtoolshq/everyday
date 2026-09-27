# Taxbook Changelog

User-visible changes only. See [DEVELOPMENT.md](../../DEVELOPMENT.md) for changelog policy.

## Unreleased

### Added

### Changed

- File upload progress uses a thinner bar.
- Paycheque amounts accept a number or a simple `+ - * /` expression and normalize when you leave the field. An invalid expression or division by zero is shown beside the field.
- Money fields show a calculator icon. Leaving the field turns a total such as `10+12+34.5` into a dollar amount. The `$` is not saved.
- Calendar dates can be typed, such as June 01, 2025, or chosen from the calendar. The saved value stays a calendar date.
- A page that fails to load, is missing, or is still loading explains that and offers a way back.
- General in the sidebar holds appearance, household members, and the Tenure connection. Data & backups stays storage, backups, and restores.

### Fixed

- Restore the sidebar link for household members and Tenure sync controls.
